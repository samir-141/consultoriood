import { api } from "@/lib/http";
import { enforceLocalRequestLimit } from "@/lib/request-limit";

type ReniecPayload = {
  nombres?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  nombreCompleto?: string;
  nombre?: string;
};

function formatName(payload: ReniecPayload): string {
  const parts = [payload.nombres, payload.apellidoPaterno, payload.apellidoMaterno]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean);
  if (parts.length > 0) return parts.join(" ");
  const fallback = payload.nombreCompleto ?? payload.nombre ?? "";
  return typeof fallback === "string" ? fallback.trim() : "";
}

async function queryProvider(url: string, headers: Record<string, string>) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", ...headers },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const data = (await response.json()) as ReniecPayload;
    const fullName = formatName(data);
    if (!fullName) return null;
    return {
      fullName,
      firstName: typeof data.nombres === "string" ? data.nombres.trim() : "",
      paternalSurname: typeof data.apellidoPaterno === "string" ? data.apellidoPaterno.trim() : "",
      maternalSurname: typeof data.apellidoMaterno === "string" ? data.apellidoMaterno.trim() : "",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function GET(request: Request) {
  return api(async () => {
    const dni = new URL(request.url).searchParams.get("dni")?.trim() ?? "";
    if (!/^\d{8}$/.test(dni)) {
      return Response.json(
        { ok: false, error: "Ingresa un DNI válido de 8 dígitos." },
        { status: 400 },
      );
    }

    enforceLocalRequestLimit("reniec", request);

    const token = process.env.RENIEC_API_TOKEN || process.env.APIS_NET_PE_TOKEN || "";
    const customUrl = process.env.RENIEC_API_URL;

    if (customUrl) {
      const endpoint = customUrl.includes("{dni}")
        ? customUrl.replace("{dni}", dni)
        : `${customUrl}${customUrl.includes("?") ? "&" : "?"}numero=${dni}`;
      const result = await queryProvider(
        endpoint,
        token ? { Authorization: `Bearer ${token}` } : {},
      );
      if (result) {
        return Response.json({ ok: true, dni, ...result, source: "reniec" });
      }
    }

    if (token) {
      const v2 = await queryProvider(
        `https://api.apis.net.pe/v2/reniec/dni?numero=${dni}`,
        { Authorization: `Bearer ${token}` },
      );
      if (v2) {
        return Response.json({ ok: true, dni, ...v2, source: "reniec" });
      }
    }

    // Intento de consulta pública sin token si el proveedor externo lo permite en esta red
    const v1 = await queryProvider(`https://api.apis.net.pe/v1/dni?numero=${dni}`, {});
    if (v1) {
      return Response.json({ ok: true, dni, ...v1, source: "reniec" });
    }

    return Response.json({
      ok: false,
      dni,
      configured: Boolean(token || customUrl),
      message: token || customUrl
        ? "No encontramos datos en RENIEC para ese DNI. Puedes escribir el nombre manualmente."
        : "Consulta RENIEC automática pendiente de token (RENIEC_API_TOKEN). Puedes escribir el nombre manualmente.",
    });
  });
}
