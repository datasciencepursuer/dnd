export interface PartyAuthPayload {
  userId: string;
  userName: string;
  mapId: string;
  expiresAt: number;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function importSigningKey(secret: string): Promise<CryptoKey> {
  return globalThis.crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret) as unknown as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function createPartyAuthToken(
  payload: PartyAuthPayload,
  secret: string
): Promise<string> {
  const encodedPayload = encodeBase64Url(textEncoder.encode(JSON.stringify(payload)));
  const key = await importSigningKey(secret);
  const signature = await globalThis.crypto.subtle.sign(
    "HMAC",
    key,
    textEncoder.encode(encodedPayload) as unknown as BufferSource
  );

  return `${encodedPayload}.${encodeBase64Url(new Uint8Array(signature))}`;
}

export async function verifyPartyAuthToken(
  token: string,
  secret: string,
  expectedMapId: string
): Promise<PartyAuthPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;

  try {
    const [encodedPayload, encodedSignature] = parts;
    const key = await importSigningKey(secret);
    const valid = await globalThis.crypto.subtle.verify(
      "HMAC",
      key,
      decodeBase64Url(encodedSignature) as unknown as BufferSource,
      textEncoder.encode(encodedPayload) as unknown as BufferSource
    );
    if (!valid) return null;

    const parsed = JSON.parse(textDecoder.decode(decodeBase64Url(encodedPayload))) as Partial<PartyAuthPayload>;
    if (
      typeof parsed.userId !== "string" ||
      typeof parsed.userName !== "string" ||
      typeof parsed.mapId !== "string" ||
      typeof parsed.expiresAt !== "number" ||
      parsed.mapId !== expectedMapId ||
      parsed.expiresAt <= Date.now()
    ) {
      return null;
    }

    return {
      userId: parsed.userId,
      userName: parsed.userName.slice(0, 100),
      mapId: parsed.mapId,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}
