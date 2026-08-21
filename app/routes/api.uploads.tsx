import { eq, desc, and } from "drizzle-orm";
import { db } from "~/.server/db";
import { uploads, type UploadType } from "~/.server/db/schema";
import { requireAuth } from "~/.server/auth/session";
import {
  deleteUploadThingFile,
  findUploadReferences,
} from "~/.server/uploads/lifecycle";

export async function loader({ request }: { request: Request }) {
  const session = await requireAuth(request);
  const userId = session.user.id;

  const url = new URL(request.url);
  const typeParam = url.searchParams.get("type");

  // Validate type parameter if provided
  if (typeParam && typeParam !== "token" && typeParam !== "map") {
    return Response.json(
      { error: "Invalid type parameter. Must be 'token' or 'map'" },
      { status: 400 }
    );
  }

  const typeFilter: UploadType | null = typeParam as UploadType | null;

  // Build query conditions
  const conditions = typeFilter
    ? and(eq(uploads.userId, userId), eq(uploads.type, typeFilter))
    : eq(uploads.userId, userId);

  const userUploads = await db
    .select({
      id: uploads.id,
      url: uploads.url,
      type: uploads.type,
      fileName: uploads.fileName,
      fileSize: uploads.fileSize,
      mimeType: uploads.mimeType,
      createdAt: uploads.createdAt,
    })
    .from(uploads)
    .where(conditions)
    .orderBy(desc(uploads.createdAt));

  return Response.json({ uploads: userUploads });
}

export async function action({ request }: { request: Request }) {
  if (request.method !== "DELETE") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const session = await requireAuth(request);
  const userId = session.user.id;

  const body = await request.json();
  const { id } = body;

  if (!id || typeof id !== "string") {
    return Response.json({ error: "Upload ID is required" }, { status: 400 });
  }

  // Find the upload and verify ownership
  const [upload] = await db
    .select()
    .from(uploads)
    .where(and(eq(uploads.id, id), eq(uploads.userId, userId)))
    .limit(1);

  if (!upload) {
    return Response.json(
      { error: "Upload not found or you don't have permission to delete it" },
      { status: 404 }
    );
  }

  const [references] = await findUploadReferences([upload.url]);
  if (!references) {
    console.error("Could not verify upload references before deletion:", upload.id);
    return Response.json(
      { error: "Could not verify upload references. Please retry." },
      { status: 500 }
    );
  }

  if (references.referencedByMapOrCharacter) {
    return Response.json(
      {
        error: "This upload is still used by a map or character and cannot be deleted.",
      },
      { status: 409 }
    );
  }

  const hasAnotherUploadRow = references.uploadRows.some((row) => row.id !== id);

  // A duplicate metadata row still owns the storage object. Remove only this
  // library row and let the remaining row keep the file alive.
  if (!hasAnotherUploadRow) {
    const storageResult = await deleteUploadThingFile(upload.url);
    if (storageResult !== "deleted") {
      if (storageResult === "invalid-file-key") {
        return Response.json(
          { error: "Upload storage key is invalid; the file was not removed." },
          { status: 500 }
        );
      }
      return Response.json(
        { error: "Could not remove the file from storage. Please retry." },
        { status: 502 }
      );
    }
  }

  // Delete from database
  await db.delete(uploads).where(eq(uploads.id, id));

  return Response.json({ success: true });
}
