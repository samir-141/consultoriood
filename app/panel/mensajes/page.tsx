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
        <h1>Mensajes de citas</h1>
        <p>Simulación de WhatsApp. Aquí puedes revisar las confirmaciones y los recordatorios de quienes aceptaron recibirlos.</p>
      </header>
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
