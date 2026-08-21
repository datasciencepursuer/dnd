import { eq } from "drizzle-orm";
import { UTApi } from "uploadthing/server";
import { db } from "~/.server/db";
import { characters, maps, uploads } from "~/.server/db/schema";
import { collectImageUrlStrings } from "./image-validation";

const utapi = new UTApi();

/**
 * Extract a file key only from the public URL formats emitted by UploadThing's
 * current ufsUrl field. Keeping this strict avoids passing arbitrary persisted
 * URLs to UTApi.deleteFiles.
 */
export function extractUploadThingFileKey(urlValue: string): string | null {
  let url: URL;

  try {
    url = new URL(urlValue);
  } catch {
    return null;
  }

  const hostname = url.hostname.toLowerCase();
  const isUploadThingHost =
    hostname === "utfs.io" || hostname.endsWith(".ufs.sh");
  if (url.protocol !== "https:" || !isUploadThingHost) return null;

  const match = url.pathname.match(/^\/f\/([^/]+)$/);
  return match?.[1] ?? null;
}

export type UploadStorageDeletionResult =
  | "deleted"
  | "invalid-file-key"
  | "storage-delete-failed";

export type UploadReferenceInfo = {
  url: string;
  referencedByMapOrCharacter: boolean;
  uploadRows: Array<{ id: string; url: string; userId: string }>;
};

function refersToSameUpload(candidateUrl: string, referenceUrl: string): boolean {
  if (candidateUrl === referenceUrl) return true;

  const candidateKey = extractUploadThingFileKey(candidateUrl);
  const referenceKey = extractUploadThingFileKey(referenceUrl);
  return candidateKey !== null && candidateKey === referenceKey;
}

/**
 * Read every reference-bearing table before deleting storage. Maps use JSONB,
 * so their nested imageUrl fields must be traversed in application code.
 * Scanning all rows also protects against the same UploadThing file being
 * represented by its utfs.io and APP_ID.ufs.sh public URL forms.
 */
export async function findUploadReferences(
  urls: Iterable<string>
): Promise<UploadReferenceInfo[]> {
  const candidateUrls = [...new Set(urls)].filter((url) => url.length > 0);
  if (candidateUrls.length === 0) return [];

  const [mapRows, characterRows, uploadRows] = await Promise.all([
    db.select({ data: maps.data }).from(maps),
    db.select({ imageUrl: characters.imageUrl }).from(characters),
    db
      .select({ id: uploads.id, url: uploads.url, userId: uploads.userId })
      .from(uploads),
  ]);

  const persistedImageUrls = new Set<string>();
  for (const mapRow of mapRows) {
    for (const imageUrl of collectImageUrlStrings(mapRow.data)) {
      persistedImageUrls.add(imageUrl);
    }
  }
  for (const characterRow of characterRows) {
    if (characterRow.imageUrl) persistedImageUrls.add(characterRow.imageUrl);
  }

  return candidateUrls.map((url) => ({
    url,
    referencedByMapOrCharacter: [...persistedImageUrls].some((referenceUrl) =>
      refersToSameUpload(url, referenceUrl)
    ),
    uploadRows: uploadRows
      .filter((uploadRow) => refersToSameUpload(url, uploadRow.url))
      .map(({ id, url: uploadUrl, userId }) => ({ id, url: uploadUrl, userId })),
  }));
}

/** Delete one UploadThing object and report failures without throwing. */
export async function deleteUploadThingFile(
  url: string
): Promise<UploadStorageDeletionResult> {
  const fileKey = extractUploadThingFileKey(url);
  if (!fileKey) {
    console.error("UploadThing file URL has no valid file key:", url);
    return "invalid-file-key";
  }

  try {
    const result = await utapi.deleteFiles(fileKey);
    if (!result.success || result.deletedCount !== 1) {
      console.error("UploadThing did not delete the expected file:", result);
      return "storage-delete-failed";
    }
  } catch (error) {
    console.error("Failed to delete from UploadThing:", error);
    return "storage-delete-failed";
  }

  return "deleted";
}

export type OrphanedUploadCleanupResult =
  | "deleted"
  | "referenced-by-map-or-character"
  | "referenced-by-another-upload"
  | "owned-by-another-user"
  | "missing-upload-row"
  | "invalid-file-key"
  | "storage-delete-failed"
  | "database-delete-failed";

/**
 * Remove metadata and storage for images belonging to a deleted map or
 * character. The metadata row is removed only when it is the sole upload row
 * for the file; duplicate rows remain a conservative reference and prevent
 * storage deletion.
 */
export async function cleanupDeletedRecordImages(
  urls: Iterable<string>,
  ownerId: string
): Promise<Array<{ url: string; result: OrphanedUploadCleanupResult }>> {
  const references = await findUploadReferences(urls);
  const results: Array<{
    url: string;
    result: OrphanedUploadCleanupResult;
  }> = [];

  for (const reference of references) {
    if (reference.referencedByMapOrCharacter) {
      results.push({
        url: reference.url,
        result: "referenced-by-map-or-character",
      });
      continue;
    }

    if (reference.uploadRows.length === 0) {
      results.push({ url: reference.url, result: "missing-upload-row" });
      continue;
    }

    if (reference.uploadRows.length > 1) {
      results.push({
        url: reference.url,
        result: "referenced-by-another-upload",
      });
      continue;
    }

    const [upload] = reference.uploadRows;
    if (upload.userId !== ownerId) {
      results.push({ url: reference.url, result: "owned-by-another-user" });
      continue;
    }

    if (!extractUploadThingFileKey(upload.url)) {
      console.error("Orphaned upload has no valid UploadThing file key:", upload.url);
      results.push({ url: reference.url, result: "invalid-file-key" });
      continue;
    }

    const storageResult = await deleteUploadThingFile(upload.url);
    if (storageResult !== "deleted") {
      results.push({ url: reference.url, result: storageResult });
      continue;
    }

    try {
      // Release the quota row only after storage deletion succeeds. Keeping
      // it when storage cleanup fails allows a later cleanup to retry; this
      // remains best-effort and must not turn a successful record delete into
      // a 5xx.
      await db.delete(uploads).where(eq(uploads.id, upload.id));
    } catch (error) {
      console.error("Failed to remove orphaned upload metadata:", error);
      results.push({ url: reference.url, result: "database-delete-failed" });
      continue;
    }

    results.push({ url: reference.url, result: "deleted" });
  }

  return results;
}
