import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { randomBytes } from "node:crypto";

const ACCESS_EXPIRY_S = 24 * 60 * 60; // 24 hours
const REFRESH_EXPIRY_D = 30; // 30 days

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET ?? randomBytes(64).toString("hex");
  return new TextEncoder().encode(secret);
}

export interface JwtPayload {
  userId: number;
  login: string;
  type: "access" | "refresh";
}

async function sign(payload: Omit<JwtPayload, "type">, type: "access" | "refresh"): Promise<string> {
  const exp = type === "access" ? `${ACCESS_EXPIRY_S}s` : `${REFRESH_EXPIRY_D}d`;
  return new SignJWT({ ...payload, type })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(getSecret());
}

async function verify(token: string, expectedType: "access" | "refresh"): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { clockTolerance: 15 });
    if (payload.type !== expectedType) return null;
    return {
      userId: payload.userId as number,
      login: payload.login as string,
      type: payload.type as "access" | "refresh",
    };
  } catch {
    return null;
  }
}

export const jwtService = { sign, verify };
