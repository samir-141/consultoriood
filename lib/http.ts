export class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

export async function api(handler: () => Promise<Response>) {
  try {
    const response = await handler();
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "no-store");
    return new Response(response.body, { status: response.status, headers });
  } catch (error) {
    if (error instanceof HttpError) {
      return Response.json({ error: error.message }, { status: error.status, headers: { "Cache-Control": "no-store" } });
    }
    const code = error && typeof error === "object" && "code" in error ? error.code : null;
    if (code === "23P01" || code === "23505") {
      return Response.json({ error: "La operación entra en conflicto con un registro existente." }, { status: 409 });
    }
    console.error("Fallo API 1.0.1", code ?? (error instanceof Error ? error.name : "UnknownError"));
    return Response.json({ error: "No pudimos completar la operación. Intenta otra vez." }, { status: 500 });
  }
}

export function verifyOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  const host = request.headers.get("host");
  if (origin && origin !== url.origin && (!host || origin !== url.protocol + "//" + host.toLowerCase())) {
    throw new HttpError(403, "Origen de la solicitud no permitido.");
  }
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  verifyOrigin(request);
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    throw new HttpError(415, "Envía los datos en formato JSON.");
  }
  if (Number(request.headers.get("content-length") ?? 0) > 15_000_000) {
    throw new HttpError(413, "La solicitud excede el tamaño permitido.");
  }
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    throw new HttpError(400, "Los datos enviados no son válidos.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "Los datos enviados no son válidos.");
  }
  return value as Record<string, unknown>;
}

export function field(value: unknown, label: string, max = 150): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) {
    throw new HttpError(400, "Revisa el campo " + label + ".");
  }
  return value.trim();
}

export function optionalField(value: unknown, label: string, max = 150) {
  return value === undefined || value === null || value === "" ? null : field(value, label, max);
}
