import { HttpError } from "./http";

const maxPerMinute = { login: 24, booking: 60, reniec: 20, token: 60 };
type Scope = keyof typeof maxPerMinute;
type Window = { expires: number; count: number };
const state = globalThis as typeof globalThis & { dentalRequestWindows?: Map<string, Window> };

function clientKey(request?: Request) {
  if (!request) return "local";
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  return (forwarded || realIp || "local").slice(0, 64);
}

export function enforceLocalRequestLimit(scope: Scope, request?: Request) {
  const windows = (state.dentalRequestWindows ??= new Map());
  const now = Date.now();
  if (windows.size > 1000) {
    for (const [k, w] of windows) {
      if (w.expires <= now) windows.delete(k);
    }
  }
  const bucketKey = `${scope}:${clientKey(request)}`;
  const current = windows.get(bucketKey);
  if (!current || current.expires <= now) {
    windows.set(bucketKey, { count: 1, expires: now + 60_000 });
    return;
  }
  if (current.count >= maxPerMinute[scope]) {
    throw new HttpError(
      429,
      "Hay muchas solicitudes. Intenta de nuevo en un momento.",
      Math.ceil((current.expires - now) / 1000),
    );
  }
  current.count += 1;
}
