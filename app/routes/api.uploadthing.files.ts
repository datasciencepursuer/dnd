import { eq, desc } from "drizzle-orm";
import { requireAuth } from "~/.server/auth/session";
import { db } from "~/.server/db";
import { uploads } from "~/.server/db/schema";

export async function loader({ request }: { request: Request }) {
  const session = await requireAuth(request);

  try {
    const files = await db
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
      .where(eq(uploads.userId, session.user.id))
      .orderBy(desc(uploads.createdAt));

    return Response.json({ files });
  } catch (error) {
    console.error("Failed to list files:", error);
    return Response.json({ error: "Failed to list files" }, { status: 500 });
  }
}
