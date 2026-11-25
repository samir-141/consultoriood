"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Job = {
  id: string;
  kind: "CONFIRMACION" | "RECORDATORIO";
  status: "PENDIENTE" | "SIMULADO" | "CANCELADO";
  availableAt: string;
  appointmentAt: string;
  patientName: string;
  serviceName: string;
  managePath: string | null;
  canSimulate: boolean;
};

const statusText = { PENDIENTE: "Pendiente", SIMULADO: "Envío simulado", CANCELADO: "Cancelado" };
const titles = { CONFIRMACION: "Confirmación", RECORDATORIO: "Recordatorio" };

function formatted(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium", timeStyle: "short", timeZone: "America/Lima",
  }).format(new Date(value));
}

async function getJobs() {
  const response = await fetch("/api/panel/mensajes", { cache: "no-store" });
  const data = await response.json() as { messages?: Job[]; error?: string };
  if (!response.ok) throw new Error(data.error ?? "No pudimos cargar los mensajes.");
  return data.messages ?? [];
}

export default function MessagesPage() {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getJobs().then((data) => {
      if (active) setJobs(data);
    }).catch((failure: Error) => {
      if (active) setError(failure.message);
    });
    return () => { active = false; };
  }, []);

  async function simulate(id: string) {
    setPending(id);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/panel/mensajes", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }),
      });
      if (!response.ok) {
        const failure = await response.json() as { error?: string };
        throw new Error(failure.error ?? "El mensaje no se pudo procesar.");
      }
      setJobs(await getJobs());
      setMessage("Envío registrado en la demostración.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "El mensaje no se pudo procesar.");
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="stack">
      <header className="page-intro">
        <h1>Mensajes de citas y recordatorios</h1>
        <p>Gestión de confirmaciones previas (30 min antes) y cola de demostración de WhatsApp.</p>
      </header>

      <article className="panel stack" aria-labelledby="future-bot-heading">
        <div>
          <h2 id="future-bot-heading">Tarea Futura: Bot de WhatsApp con API Local y Modelo de Comprensión</h2>
          <p className="muted">
            Actualmente recepción confirma manualmente 30 minutos antes de cada visita desde el{" "}
            <Link href="/panel" className="underline font-semibold">Resumen del día</Link>.
            Antes de activar envíos automáticos, la hoja de ruta contempla:
          </p>
        </div>
        <ul className="list-disc pl-5 space-y-1 text-sm">
          <li><strong>Clasificador de intención local (ONNX cuantizado):</strong> comprensión rápida en CPU (10–50 ms) sin costos por API ni envío de datos sensibles a terceros.</li>
          <li><strong>Enrutador con reglas reales del consultorio:</strong> consulta disponibilidad en <code>/api/reservas</code> (intervalos 30m, servicios 45m = 2 bloques, regla de 15 min + consultas presenciales y bloqueos de cirugías/días libres).</li>
          <li><strong>API local de WhatsApp:</strong> automatización de confirmaciones 30 min antes y respuestas 24/7 (ver <code>docs/TAREA_FUTURA_BOT_WHATSAPP.md</code>).</li>
        </ul>
      </article>
      {error && <p role="alert" className="error">{error}</p>}
      {message && <p role="status">{message}</p>}
      {!jobs && !error && <p>Cargando mensajes…</p>}
      {jobs?.length === 0 && <p className="panel">Aún no hay mensajes. Confirma una reserva con el contacto por WhatsApp habilitado.</p>}
      {jobs?.map((job) => (
        <article className="panel stack" key={job.id}>
          <div>
            <h2>{titles[job.kind]} · {job.patientName}</h2>
            <p className="muted">{statusText[job.status]} · {formatted(job.availableAt)}</p>
          </div>
          <details>
            <summary>Ver mensaje</summary>
            <p>Hola, {job.patientName}. Tu cita de {job.serviceName} es el {formatted(job.appointmentAt)}.</p>
            {job.managePath && <Link className="button-secondary mt-3" href={job.managePath}>Gestionar cita</Link>}
          </details>
          {job.canSimulate && (
            <button className="button" type="button" disabled={pending !== null} onClick={() => simulate(job.id)}>
              {pending === job.id ? "Procesando…" : "Simular envío"}
            </button>
          )}
        </article>
      ))}
    </section>
  );
}
