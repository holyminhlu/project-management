type JwtHeader = {
  alg?: string;
  typ?: string;
  [key: string]: unknown;
};

type JwtPayload = {
  exp?: number;
  nbf?: number;
  iat?: number;
  iss?: string;
  sub?: string;
  [key: string]: unknown;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64UrlToBytes(input: string): Uint8Array {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  const base64 = normalized + padding;

  if (typeof atob !== "function") {
    throw new Error("atob is not available in this runtime");
  }

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function decodeJwtPart<T>(part: string): T | null {
  try {
    const bytes = base64UrlToBytes(part);
    const json = decoder.decode(bytes);
    return safeJsonParse<T>(json);
  } catch {
    return null;
  }
}

function isExpired(payload: JwtPayload, nowMs: number) {
  if (typeof payload.exp !== "number") return false;
  return nowMs >= payload.exp * 1000;
}

function isNotBefore(payload: JwtPayload, nowMs: number) {
  if (typeof payload.nbf !== "number") return false;
  return nowMs < payload.nbf * 1000;
}

export async function verifyJwtHs256(token: string, secret: string): Promise<JwtPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  if (!encodedHeader || !encodedPayload || !encodedSignature) return null;

  const header = decodeJwtPart<JwtHeader>(encodedHeader);
  if (!header || header.alg !== "HS256") return null;

  const payload = decodeJwtPart<JwtPayload>(encodedPayload);
  if (!payload) return null;

  const signingInput = `${encodedHeader}.${encodedPayload}`;

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret) as unknown as BufferSource,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );

    const signatureBytes = base64UrlToBytes(encodedSignature);
    const ok = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes as unknown as BufferSource,
      encoder.encode(signingInput) as unknown as BufferSource,
    );

    if (!ok) return null;

    const now = Date.now();
    if (isNotBefore(payload, now)) return null;
    if (isExpired(payload, now)) return null;

    return payload;
  } catch {
    return null;
  }
}
