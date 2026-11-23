import { createHmac, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const state = globalThis as typeof globalThis & { dentalBookingKey101?: Promise<Buffer> };

async function loadKey() {
  const directory = process.env.DENTAL_DATA_DIR ?? path.join(process.cwd(), ".dental-local", "postgres");
  if (directory === "memory://") return randomBytes(32);
  const file = path.resolve(/* turbopackIgnore: true */ directory + ".booking-key");
  await mkdir(path.dirname(file), { recursive: true });
  let key: Buffer;
  try {
    key = await readFile(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const candidate = randomBytes(32);
    try {
      await writeFile(file, candidate, { flag: "wx", mode: 0o600 });
      key = candidate;
    } catch (writeError) {
      if ((writeError as NodeJS.ErrnoException).code !== "EEXIST") throw writeError;
      key = await readFile(file);
    }
  }
  if (key.length !== 32) throw new Error("Clave local de reservas inválida");
  return key;
}

export async function bookingToken(id: string) {
  state.dentalBookingKey101 ??= loadKey().catch((error) => {
    delete state.dentalBookingKey101;
    throw error;
  });
  return createHmac("sha256", await state.dentalBookingKey101).update("reserva:" + id).digest("hex");
}
