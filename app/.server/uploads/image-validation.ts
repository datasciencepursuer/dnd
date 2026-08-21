import { and, eq, inArray } from "drizzle-orm";
import { db } from "~/.server/db";
import { groupMembers, uploads, type UploadType } from "~/.server/db/schema";

const MAX_PERSISTED_IMAGE_URL_LENGTH = 2048;

export type ImageUrlValidationResult =
  | { valid: true }
  | { valid: false; error: string };

interface ImageUrlValidationOptions {
  allowedExistingUrls?: Iterable<string>;
  /**
   * Server-authorized group scope. Members' uploads are allowed in addition
   * to the current user's uploads; callers must derive this from auth/map
   * state rather than from client-supplied ownership data.
   */
  groupId?: string;
  type?: UploadType;
}

/** Collect only fields that will be rendered as persisted image URLs. */
export function collectImageUrlValues(value: unknown): unknown[] {
  const values: unknown[] = [];

  function visit(current: unknown) {
    if (Array.isArray(current)) {
      for (const item of current) visit(item);
      return;
    }

    if (!current || typeof current !== "object") return;

    for (const [key, nested] of Object.entries(current)) {
      if (key === "imageUrl") values.push(nested);
      visit(nested);
    }
  }

  visit(value);
  return values;
}

/** Collect distinct, non-empty string image URLs from persisted data. */
export function collectImageUrlStrings(value: unknown): string[] {
  return [
    ...new Set(
      collectImageUrlValues(value).filter(
        (candidate): candidate is string =>
          typeof candidate === "string" && candidate.length > 0
      )
    ),
  ];
}

/**
 * Validate image URLs before persisting them. New URLs must belong to an
 * UploadThing row owned by the current user. Existing values can be allowed
 * by the caller when preserving legacy or shared map data unchanged.
 */
export async function validateOwnedImageUrls(
  userId: string,
  values: Iterable<unknown>,
  options: ImageUrlValidationOptions = {}
): Promise<ImageUrlValidationResult> {
  const allowedExistingUrls = new Set(options.allowedExistingUrls ?? []);
  const candidateUrls = new Set<string>();

  for (const value of values) {
    if (value === null || value === undefined) continue;

    if (typeof value !== "string") {
      return { valid: false, error: "Image URLs must be strings or null." };
    }

    if (value.length === 0) continue;
    if (value.length > MAX_PERSISTED_IMAGE_URL_LENGTH || value !== value.trim()) {
      return { valid: false, error: "Image URL is invalid or too long." };
    }

    if (!allowedExistingUrls.has(value)) candidateUrls.add(value);
  }

  if (candidateUrls.size === 0) return { valid: true };

  const authorizedUserIds = new Set([userId]);
  if (options.groupId) {
    const members = await db
      .select({ userId: groupMembers.userId })
      .from(groupMembers)
      .where(eq(groupMembers.groupId, options.groupId));

    for (const member of members) authorizedUserIds.add(member.userId);
  }

  const conditions = [
    inArray(uploads.userId, [...authorizedUserIds]),
    inArray(uploads.url, [...candidateUrls]),
  ];
  if (options.type) conditions.push(eq(uploads.type, options.type));

  const ownedUploads = await db
    .select({ url: uploads.url })
    .from(uploads)
    .where(and(...conditions));

  const ownedUrls = new Set(ownedUploads.map((upload) => upload.url));
  for (const url of candidateUrls) {
    if (!ownedUrls.has(url)) {
      return {
        valid: false,
        error: "Image must be uploaded to your image library before it can be saved.",
      };
    }
  }

  return { valid: true };
}
