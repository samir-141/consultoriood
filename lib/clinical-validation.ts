import { HttpError } from "@/lib/http";

export function requiredText(value: unknown, label: string, limit: number) {
  const text = optionalText(value, label, limit);
  if (!text) throw new HttpError(400, `Completa ${label}.`);
  return text;
}

export function optionalText(value: unknown, label: string, limit: number) {
  if (value == null) return "";
  if (typeof value !== "string" || value.length > limit || value.includes("\0")) {
    throw new HttpError(400, `Revisa ${label}.`);
  }
  return value.trim();
}

export function requiredId(value: unknown, label: string) {
  const id = optionalId(value, label);
  if (!id) throw new HttpError(400, `Selecciona ${label}.`);
  return id;
}

export function optionalId(value: unknown, label: string) {
  const id = optionalText(value, label, 120);
  if (id && !/^[A-Za-z0-9_-]+$/.test(id)) throw new HttpError(400, `Revisa ${label}.`);
  return id || null;
}

export function integerBetween(value: unknown, label: string, minimum: number, maximum: number) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum || value > maximum) {
    throw new HttpError(400, `Revisa ${label}.`);
  }
  return value;
}

export function toothNumber(value: unknown) {
  const tooth = typeof value === "string" && /^\d{2}$/.test(value) ? Number(value) : value;
  const number = integerBetween(tooth, "la pieza dental", 11, 85);
  const quadrant = Math.floor(number / 10);
  const index = number % 10;
  if (index < 1 || index > (quadrant < 5 ? 8 : 5)) throw new HttpError(400, "Selecciona una pieza FDI válida.");
  return number;
}

export function oneOf<T extends string>(value: unknown, possibilities: readonly T[], label: string) {
  const result = possibilities.find((item) => item === value);
  if (!result) throw new HttpError(400, `Revisa ${label}.`);
  return result;
}
