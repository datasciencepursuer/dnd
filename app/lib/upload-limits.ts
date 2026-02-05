// Upload file size limits - must match server config in app/.server/uploadthing.ts
export const UPLOAD_LIMITS = {
  TOKEN_MAX_SIZE: "16MB",
  TOKEN_MAX_SIZE_BYTES: 16 * 1024 * 1024,
  MAP_MAX_SIZE: "32MB",
  MAP_MAX_SIZE_BYTES: 32 * 1024 * 1024,
} as const;

/**
 * Parse a file size error message and return a user-friendly message
 */
export function parseUploadError(error: string, maxSize: string): string {
  const lowerError = error.toLowerCase();

  // Check for common file size related errors
  if (
    lowerError.includes("file size") ||
    lowerError.includes("too large") ||
    lowerError.includes("filesize") ||
    lowerError.includes("size limit") ||
    lowerError.includes("exceeded") ||
    lowerError.includes("max size")
  ) {
    return `File too large. Maximum size is ${maxSize}.`;
  }

  // Check for file type errors
  if (
    lowerError.includes("file type") ||
    lowerError.includes("invalid type") ||
    lowerError.includes("not allowed")
  ) {
    return "Invalid file type. Please upload an image file (PNG, JPG, GIF, WebP).";
  }

  // Return original error if not recognized
  return error;
}
