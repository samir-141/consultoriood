export class HttpError extends Error {
  constructor(public readonly status: number, message: string, public readonly retryAfter?: number) {
    super(message);
  }
}

export async function api(handler: () => Promise<Response>) {
  const cacheControl = "private, no-store";
  try {
    const response = await handler();
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", cacheControl);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  } catch (error) {
    const headers = { "Cache-Control": cacheControl };
    if (error instanceof HttpError) {
      const errorHeaders = new Headers(headers);
      if (error.retryAfter !== undefined) errorHeaders.set("Retry-After", String(error.retryAfter));
      // The request body may have been rejected before it was fully read.
      if (error.status === 413) errorHeaders.set("Connection", "close");
      return Response.json({ error: error.message }, { status: error.status, headers: errorHeaders });
    }
    const code = error && typeof error === "object" && "code" in error ? error.code : null;
    if (code === "23P01" || code === "23505") {
      return Response.json({ error: "La operación entra en conflicto con un registro existente." }, { status: 409, headers });
    }
    if (code === "22007" || code === "22008" || code === "22P02" || code === "23502" || code === "23503" || code === "23514") {
      return Response.json({ error: "Verifica el formato y las referencias de los datos enviados." }, { status: 400, headers });
    }
    console.error("Fallo API 1.0.1", code ?? (error instanceof Error ? error.name : "UnknownError"));
    return Response.json({ error: "No pudimos completar la operación. Intenta otra vez." }, { status: 500, headers });
  }
}

export function verifyOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  const host = request.headers.get("host");
  if (request.headers.get("sec-fetch-site") === "cross-site" ||
      (origin && origin !== url.origin && (!host || origin !== url.protocol + "//" + host.toLowerCase()))) {
    throw new HttpError(403, "Origen de la solicitud no permitido.");
  }
}

export async function readBoundedBody(request: Request, limit: number) {
  const tooLarge = () => new HttpError(413, "La solicitud excede el tamaño permitido.");
  if (Number(request.headers.get("content-length")) > limit) throw tooLarge();
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "Envía los datos de la solicitud.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > limit) {
        void reader.cancel().catch(() => undefined);
        throw tooLarge();
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(size);
  let position = 0;
  for (const chunk of chunks) {
    body.set(chunk, position);
    position += chunk.byteLength;
  }
  return body;
}

export async function readJson(request: Request, maxBytes = 256 * 1024): Promise<Record<string, unknown>> {
  verifyOrigin(request);
  const mediaType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (mediaType !== "application/json") {
    throw new HttpError(415, "Envía los datos en formato JSON.");
  }
  let value: unknown;
  try {
    const body = await readBoundedBody(request, maxBytes);
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "Los datos enviados no son válidos.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "Los datos enviados no son válidos.");
  }
  return value as Record<string, unknown>;
}

export function field(value: unknown, label: string, max = 150): string {
  if (typeof value !== "string" || value.includes("\0") || value.length > max * 2
      || !value.trim() || value.trim().length > max) {
    throw new HttpError(400, "Revisa el campo " + label + ".");
  }
  return value.trim();
}

export function optionalField(value: unknown, label: string, max = 150) {
  if (value === undefined || value === null) return null;
  if (typeof value === "string" && !value.includes("\0") && !value.trim()) {
    if (value.length > max * 2) throw new HttpError(400, "Revisa el campo " + label + ".");
    return null;
  }
  return field(value, label, max);
}
