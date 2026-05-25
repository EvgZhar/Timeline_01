import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;
const SEPARATOR = ":";

function hash(password: string): string {
  const salt = randomBytes(32).toString("hex");
  const derivedKey = scryptSync(password, salt, KEY_LENGTH);
  return salt + SEPARATOR + derivedKey.toString("hex");
}

function verify(password: string, stored: string): boolean {
  const [salt, key] = stored.split(SEPARATOR);
  const derivedKey = scryptSync(password, salt, KEY_LENGTH);
  return timingSafeEqual(derivedKey, Buffer.from(key, "hex"));
}

export const passwordService = { hash, verify };
