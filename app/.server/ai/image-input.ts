const KIB = 1024;
const MIB = KIB * KIB;

export const AI_REFERENCE_MAX_BYTES = 32 * MIB;
export const AI_REFERENCE_MAX_REQUEST_BYTES =
  Math.ceil((AI_REFERENCE_MAX_BYTES * 4) / 3) + 64 * KIB;
const AI_REFERENCE_FETCH_TIMEOUT_MS = 10_000;
const MAX_URL_LENGTH = 2048;
const ALLOWED_MIME_TYPES = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export interface ValidatedImageReference {
  base64: string;
  mimeType: string;
}

export class ImageInputError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 413 | 422 = 422
  ) {
    super(message);
    this.name = "ImageInputError";
  }
}

/** Read JSON without allowing an oversized request body to be buffered. */
export async function readBoundedJson<T>(
  request: Request,
  maxBytes = AI_REFERENCE_MAX_REQUEST_BYTES
): Promise<T> {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new ImageInputError("Request body is too large.", 413);
  }

  const reader = request.body?.getReader();
  if (!reader) throw new ImageInputError("Request body is required.", 400);

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new ImageInputError("Request body is too large.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8"));
  } catch {
    throw new ImageInputError("Request body must be valid JSON.", 400);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ImageInputError("Request body must be a JSON object.", 400);
  }

  return parsed as T;
}

function normalizeMimeType(value: unknown): string {
  if (typeof value !== "string") {
    throw new ImageInputError("Reference image MIME type is required.", 400);
  }

  const mimeType = value.split(";", 1)[0].trim().toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new ImageInputError("Reference image must be PNG, JPEG, GIF, or WebP.", 422);
  }
  return mimeType;
}

function decodedBase64ByteLength(value: string): number {
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  return Math.floor((value.length * 3) / 4) - padding;
}

function matchesSignature(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

function validateImageBytes(bytes: Uint8Array, mimeType: string): void {
  if (bytes.byteLength === 0) {
    throw new ImageInputError("Reference image is empty.", 422);
  }
  if (bytes.byteLength > AI_REFERENCE_MAX_BYTES) {
    throw new ImageInputError("Reference image is too large.", 413);
  }

  const validSignature =
    (mimeType === "image/png" && matchesSignature(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ||
    (mimeType === "image/jpeg" && matchesSignature(bytes, [0xff, 0xd8, 0xff])) ||
    (mimeType === "image/webp" && matchesSignature(bytes, [0x52, 0x49, 0x46, 0x46]) && matchesSignature(bytes, [0x57, 0x45, 0x42, 0x50], 8)) ||
    (mimeType === "image/gif" && (matchesSignature(bytes, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) || matchesSignature(bytes, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])));

  if (!validSignature) {
    throw new ImageInputError("Reference image content does not match its MIME type.", 422);
  }
}

export function validateBase64Image(
  value: unknown,
  mimeTypeValue: unknown
): ValidatedImageReference {
  if (typeof value !== "string" || value.length === 0) {
    throw new ImageInputError("Reference image base64 data is required.", 400);
  }

  const mimeType = normalizeMimeType(mimeTypeValue);
  let base64 = value.trim();
  const dataUriMatch = base64.match(/^data:([^;,]+);base64,(.*)$/s);
  if (dataUriMatch) {
    const dataUriMimeType = normalizeMimeType(dataUriMatch[1]);
    if (dataUriMimeType !== mimeType) {
      throw new ImageInputError("Reference image MIME type does not match its data URI.", 422);
    }
    base64 = dataUriMatch[2];
  }

  if (base64.length === 0 || base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
    throw new ImageInputError("Reference image base64 data is invalid.", 422);
  }

  const byteLength = decodedBase64ByteLength(base64);
  if (byteLength <= 0) {
    throw new ImageInputError("Reference image is empty.", 422);
  }
  if (byteLength > AI_REFERENCE_MAX_BYTES) {
    throw new ImageInputError("Reference image is too large.", 413);
  }

  const bytes = Buffer.from(base64, "base64");
  validateImageBytes(bytes, mimeType);
  return { base64, mimeType };
}

function validateRemoteImageUrl(value: unknown): URL {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_URL_LENGTH) {
    throw new ImageInputError("Reference image URL is invalid.", 400);
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ImageInputError("Reference image URL is invalid.", 400);
  }

  const hostname = url.hostname.toLowerCase();
  const isUploadThingHost =
    hostname === "utfs.io" || hostname === "ufs.sh" || hostname.endsWith(".ufs.sh");
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    !isUploadThingHost ||
    !url.pathname.startsWith("/f/")
  ) {
    throw new ImageInputError("Reference image must be an UploadThing image URL.", 422);
  }

  return url;
}

async function readBoundedResponse(response: Response): Promise<Uint8Array> {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > AI_REFERENCE_MAX_BYTES) {
    throw new ImageInputError("Reference image is too large.", 413);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new ImageInputError("Reference image response is empty.", 422);

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > AI_REFERENCE_MAX_BYTES) {
        await reader.cancel();
        throw new ImageInputError("Reference image is too large.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
}

export async function fetchRemoteImageAsReference(value: unknown): Promise<ValidatedImageReference> {
  const url = validateRemoteImageUrl(value);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_REFERENCE_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new ImageInputError(`Could not load reference image (HTTP ${response.status}).`, 422);
    }

    const mimeType = normalizeMimeType(response.headers.get("content-type"));
    const bytes = await readBoundedResponse(response);
    validateImageBytes(bytes, mimeType);

    return {
      base64: Buffer.from(bytes).toString("base64"),
      mimeType,
    };
  } catch (error) {
    if (error instanceof ImageInputError) throw error;
    throw new ImageInputError("Could not load reference image within the time limit.", 422);
  } finally {
    clearTimeout(timeout);
  }
}
