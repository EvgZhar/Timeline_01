import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

async function hash(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function verify(password: string, stored: string): Promise<boolean> {
  return bcrypt.compare(password, stored);
}

export const passwordService = { hash, verify };
