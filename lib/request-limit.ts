import { HttpError } from "./http";

const maxPerMinute = { login: 24, booking: 60 };
type Scope = keyof typeof maxPerMinute;
type Window = { expires: number; count: number };
const state = globalThis as typeof globalThis & { dentalRequestWindows?: Partial<Record<Scope, Window>> };

export function enforceLocalRequestLimit(scope: Scope) {
  const windows = state.dentalRequestWindows ??= {};
  const now = Date.now();
  const current = windows[scope];
  if (!current || current.expires <= now) {
    windows[scope] = { count: 1, expires: now + 60_000 };
    return;
  }
  if (current.count >= maxPerMinute[scope]) {
    throw new HttpError(429, "Hay muchas solicitudes. Intenta de nuevo en un momento.", Math.ceil((current.expires - now) / 1000));
  }
  current.count += 1;
}
