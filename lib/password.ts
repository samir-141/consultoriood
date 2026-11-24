import { randomBytes, scrypt, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";

const derivePassword = promisify(scrypt);

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}

export async function verifyPassword(password: string, value: string) {
  const [salt, hash] = value.split(":");
  if (!salt || !hash) return false;
  const actual = await derivePassword(password, salt, 64) as Buffer;
  const expected = Buffer.from(hash, "hex");
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}

export function digest(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
