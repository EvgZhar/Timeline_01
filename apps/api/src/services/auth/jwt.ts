import { createHmac, randomBytes } from "node:crypto";

const HEADER = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
const TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getSecret(): string {
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = randomBytes(64).toString("hex");
  }
  return process.env.JWT_SECRET;
}

export interface JwtPayload {
  userId: number;
  login: string;
  exp: number;
}

function base64url(str: string): string {
  return Buffer.from(str).toString("base64url");
}

function sign(payload: { userId: number; login: string }): string {
  const fullPayload: JwtPayload = {
    ...payload,
    exp: Date.now() + TOKEN_EXPIRY_MS,
  };
  const payloadStr = JSON.stringify(fullPayload);
  const payloadB64 = base64url(payloadStr);
  const signature = createHmac("sha256", getSecret())
    .update(HEADER + "." + payloadB64)
    .digest("base64url");
  return `${HEADER}.${payloadB64}.${signature}`;
}

function verify(token: string): JwtPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payloadB64, signature] = parts;
  const expectedSig = createHmac("sha256", getSecret())
    .update(header + "." + payloadB64)
    .digest("base64url");
  if (signature !== expectedSig) return null;
  try {
    const payload: JwtPayload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export const jwtService = { sign, verify };
