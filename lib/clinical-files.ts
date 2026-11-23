import { HttpError, readJson } from "@/lib/http";
import { requiredText } from "@/lib/clinical-validation";

const fileLimit = 10 * 1024 * 1024;
const formats: Record<string, number[]> = {
  "application/pdf": [0x25, 0x50, 0x44, 0x46, 0x2d],
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/png": [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
};

export type PrivateFile = { name: string; mime: string; content: Uint8Array };

function checkedFile(name: unknown, mime: unknown, content: Uint8Array): PrivateFile {
  const fileName = requiredText(name, "el nombre del archivo", 200);
  if (typeof mime !== "string" || !Object.hasOwn(formats, mime)) {
    throw new HttpError(415, "Elige un archivo PDF, PNG o JPG.");
  }
  if (!content.length || content.length > fileLimit) throw new HttpError(413, "El archivo debe pesar hasta 10 MB.");
  if (!formats[mime].every((byte, index) => content[index] === byte)) {
    throw new HttpError(415, "El contenido no coincide con el formato del archivo.");
  }
  return { name: fileName.replace(/[\r\n/\\]/g, "_"), mime, content };
}

async function readBoundedBody(request: Request, limit: number) {
  if (Number(request.headers.get("content-length")) > limit) {
    throw new HttpError(413, "El archivo debe pesar hasta 10 MB.");
  }
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "Envía los datos de la solicitud.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.length;
      if (size > limit) {
        await reader.cancel().catch(() => undefined);
        throw new HttpError(413, "El archivo debe pesar hasta 10 MB.");
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
    position += chunk.length;
  }
  return body;
}

export async function readClinicalUpload(request: Request) {
  const type = request.headers.get("content-type");
  if (!type?.startsWith("multipart/form-data;")) throw new HttpError(400, "Selecciona un archivo.");
  const body = await readBoundedBody(request, fileLimit + 64 * 1024);
  const parsed = await new Response(body, { headers: { "Content-Type": type } }).formData()
    .catch(() => { throw new HttpError(400, "No se pudo leer el archivo enviado."); });
  const file = parsed.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "Selecciona un archivo.");
  return checkedFile(file.name, file.type, new Uint8Array(await file.arrayBuffer()));
}

export async function readPaymentBody(request: Request) {
  const body = await readBoundedBody(request, Math.ceil(fileLimit / 3) * 4 + 64 * 1024);
  return readJson(new Request(request.url, { method: request.method, headers: request.headers, body }));
}

export function readPaymentProof(body: Record<string, unknown>) {
  if (!body.proofName && !body.proofMime && !body.proofBase64) return null;
  const value = body.proofBase64;
  if (typeof value !== "string" || !value || value.length % 4 !== 0 || !/^[a-zA-Z0-9+/]+={0,2}$/.test(value)) {
    throw new HttpError(400, "Selecciona un comprobante válido.");
  }
  if (value.length > Math.ceil(fileLimit / 3) * 4) {
    throw new HttpError(413, "El archivo debe pesar hasta 10 MB.");
  }
  return checkedFile(body.proofName, body.proofMime, Buffer.from(value, "base64"));
}

export function privateJson(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

export function privateDownload(file: PrivateFile) {
  const name = [...file.name].map((character) => /[a-zA-Z0-9._ -]/.test(character) ? character : "_").join("");
  const encoded = encodeURIComponent(file.name).replace(/['()*]/g, (character) =>
    "%" + character.charCodeAt(0).toString(16).toUpperCase());
  return new Response(new Uint8Array(file.content), {
    headers: {
      "Content-Type": file.mime,
      "Content-Disposition": `attachment; filename="${name}"; filename*=UTF-8''${encoded}`,
      "Content-Length": String(file.content.byteLength),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
