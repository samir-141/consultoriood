export type ReniecResult = {
  ok: boolean;
  dni: string;
  fullName?: string;
  firstName?: string;
  paternalSurname?: string;
  maternalSurname?: string;
  message?: string;
  error?: string;
};

export async function lookupDniReniec(rawDni: string, signal?: AbortSignal): Promise<ReniecResult> {
  const dni = rawDni.replace(/\D/g, "").slice(0, 8);
  if (dni.length !== 8) {
    return { ok: false, dni, error: "El DNI debe tener 8 dígitos." };
  }
  const response = await fetch(`/api/reniec?dni=${encodeURIComponent(dni)}`, {
    cache: "no-store",
    signal,
  });
  const data = (await response.json().catch(() => null)) as ReniecResult | null;
  if (!data) {
    return { ok: false, dni, message: "No se pudo consultar RENIEC." };
  }
  return data;
}
