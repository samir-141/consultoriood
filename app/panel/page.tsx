"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { atLima } from "@/lib/clinic-time";
import {
  dateLabel,
  errorMessage,
  postJson,
  roleLabels,
  staffFetch,
  statusLabels,
  todayLima,
  useStaff,
  type Agenda,
  type Appointment,
} from "./agenda/staff";
import styles from "./agenda/staff.module.css";

const activeQueueStatuses = new Set(["CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED"]);

function whatsappConfirmHref(appointment: Appointment) {
  const digits = (appointment.patientPhone ?? "").replace(/\D/g, "");
  if (!digits) return null;
  const intl = digits.length === 9 && digits.startsWith("9") ? `51${digits}` : digits;
  const msg = `Hola ${appointment.patientName}, te escribimos de GOMEZ DELGADO DENTAL para confirmar tu visita de hoy a las ${appointment.time} (${appointment.serviceName}). Por favor confírmanos si asistirás.`;
  return `https://wa.me/${intl}?text=${encodeURIComponent(msg)}`;
}

function minus30Label(time: string) {
  const [h, m] = time.split(":").map(Number);
  const total = Math.max(0, h * 60 + m - 30);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export default function StaffDashboard() {
  const staff = useStaff();
  const [date] = useState(todayLima);
  const [agenda, setAgenda] = useState<Agenda | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [clock, setClock] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ date, days: "1", professionalId: staff.professionalId ?? "any" });
    staffFetch<Agenda>("/api/panel/agenda?" + query, { signal: controller.signal })
      .then(setAgenda)
      .catch((problem) => {
        if (!controller.signal.aborted) setError(errorMessage(problem));
      });
    return () => controller.abort();
  }, [date, staff.professionalId, attempt]);

  async function markReminderSent(appointmentId: string) {
    setBusyId(appointmentId);
    setNotice("");
    setError("");
    try {
      await postJson("/api/panel/agenda", { action: "mark_reminder_30m", appointmentId });
      setNotice("Recordatorio de 30 min marcado como enviado.");
      setAttempt((v) => v + 1);
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setBusyId(null);
    }
  }

  async function markCheckedIn(appointmentId: string) {
    setBusyId(appointmentId);
    setNotice("");
    setError("");
    try {
      await postJson("/api/panel/agenda", { action: "status", appointmentId, status: "CHECKED_IN" });
      setNotice("Paciente marcado en sede.");
      setAttempt((v) => v + 1);
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setBusyId(null);
    }
  }

  const appointments = agenda?.appointments ?? [];
  const orderedQueue = appointments
    .filter((appointment) => activeQueueStatuses.has(appointment.status))
    .sort((first, second) => first.time.localeCompare(second.time));
  const pending = orderedQueue.filter((appointment) => appointment.status !== "COMPLETED");

  const confirmedToday = orderedQueue.filter((a) => a.status === "CONFIRMED");
  const reminderItems = confirmedToday.map((appt) => {
    const startMs = atLima(appt.date, appt.time).getTime();
    const minutesUntil = Math.round((startMs - clock) / 60_000);
    const inUrgentWindow = !appt.reminder30mSentAt && minutesUntil <= 35 && minutesUntil >= -15;
    return { appt, minutesUntil, inUrgentWindow };
  });

  const blocks = [...(agenda?.blocks ?? [])].sort((a, b) => a.time.localeCompare(b.time));

  return (
    <div className={styles.stack}>
      <header className={styles.intro}>
        <h1>Hola, {staff.name}</h1>
        <p>{roleLabels[staff.role]} · {dateLabel(date)}</p>
      </header>

      {notice && <p className={styles.notice} role="status">{notice}</p>}

      {/* RECORDATORIO MANUAL 30 MIN ANTES DE LA VISITA (Antes de habilitar Bot WhatsApp) */}
      {staff.role !== "ODONTOLOGO" && (
        <section className={`${styles.card} ${styles.stack}`} aria-labelledby="reminders-30m-title">
          <div className={styles.row}>
            <div>
              <h2 id="reminders-30m-title">Confirmación de visita (30 min antes)</h2>
              <p className={styles.muted}>
                Escribe a cada paciente 30 minutos antes de su cita para confirmar asistencia mientras se habilita el bot local de WhatsApp.
              </p>
            </div>
            <Link className={styles.secondary} href="/panel/mensajes">Ver tarea futura Bot WhatsApp</Link>
          </div>

          {!agenda ? (
            <p className={styles.muted}>Revisando citas confirmadas de hoy…</p>
          ) : reminderItems.length === 0 ? (
            <p className={styles.muted}>No hay citas confirmadas pendientes de asistencia para hoy.</p>
          ) : (
            <div className={styles.stack}>
              {reminderItems.map(({ appt, minutesUntil, inUrgentWindow }) => {
                const waUrl = whatsappConfirmHref(appt);
                return (
                  <article
                    key={appt.id}
                    className={inUrgentWindow ? styles.reminderAlert : styles.reminderUpcoming}
                  >
                    <div className={styles.row}>
                      <div>
                        <strong>{appt.time} · {appt.patientName}</strong>
                        <p className={styles.muted}>
                          {appt.serviceName} · Tel: {appt.patientPhone || "Sin teléfono"} ·{" "}
                          {appt.reminder30mSentAt
                            ? "Confirmación previa enviada"
                            : inUrgentWindow
                              ? `Escribir ahora (faltan ${Math.max(0, minutesUntil)} min)`
                              : minutesUntil > 35
                                ? `Escribir a las ${minus30Label(appt.time)} (30 min antes)`
                                : "Turno ya iniciado"}
                        </p>
                      </div>
                      {appt.reminder30mSentAt ? (
                        <span className={styles.reminderDoneBadge}>✓ Escrito (30m)</span>
                      ) : (
                        <div className={styles.actions}>
                          {waUrl && (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.secondary}
                            >
                              Escribir por WhatsApp
                            </a>
                          )}
                          <button
                            type="button"
                            className={styles.primary}
                            disabled={busyId === appt.id}
                            onClick={() => void markReminderSent(appt.id)}
                          >
                            {busyId === appt.id ? "Guardando…" : "Marcar recordatorio enviado"}
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* CARD DE ORDEN DE ATENCIÓN DEL DÍA (Recepción / Odontología) */}
      <section className={`${styles.card} ${styles.stack}`} aria-labelledby="today-title">
        <div className={styles.row}>
          <h2 id="today-title">
            {staff.role === "ODONTOLOGO" ? "Mi orden de pacientes hoy" : "Orden de pacientes hoy"}
          </h2>
          <Link className={styles.primary} href="/panel/agenda">Abrir agenda completa</Link>
        </div>
        {error ? (
          <div className={styles.stack}>
            <p className={styles.error} role="alert">{error}</p>
            <button className={styles.secondary} type="button" onClick={() => { setError(""); setAttempt((value) => value + 1); }}>Actualizar</button>
          </div>
        ) : agenda ? (
          <>
            <dl className={styles.metrics}>
              <div><dt>Por atender</dt><dd>{pending.length}</dd></div>
              <div><dt>Completadas</dt><dd>{appointments.filter((appointment) => appointment.status === "COMPLETED").length}</dd></div>
              <div><dt>Cirugías / Bloqueos</dt><dd>{blocks.length}</dd></div>
            </dl>
            {orderedQueue.length > 0 ? (
              <ol className={styles.recordList} aria-label="Orden de atención de pacientes">
                {orderedQueue.map((appointment, idx) => (
                  <li className={styles.queueRow} key={appointment.id}>
                    <span className={styles.orderBadge}>#{idx + 1}</span>
                    <div className={styles.eventTitle}>
                      <strong>{appointment.time}–{appointment.endTime} · {appointment.patientName}</strong>
                      <small>
                        {appointment.serviceName} · {appointment.professionalName}
                        {appointment.patientPhone ? ` · Tel: ${appointment.patientPhone}` : ""}
                      </small>
                    </div>
                    <div className={styles.actions}>
                      <span className={styles.pill} data-status={appointment.status}>{statusLabels[appointment.status]}</span>
                      {appointment.status === "CONFIRMED" && (
                        <button
                          type="button"
                          className={styles.secondary}
                          disabled={busyId === appointment.id}
                          onClick={() => void markCheckedIn(appointment.id)}
                        >
                          En sede
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className={styles.muted}>Todavía no hay pacientes agendados para hoy.</p>
            )}

            {blocks.length > 0 && (
              <div className={styles.stack}>
                <h3>Cirugías y bloqueos del día</h3>
                <ul className={styles.recordList}>
                  {blocks.map((block) => (
                    <li className={styles.queueRow} key={block.id}>
                      <span className={styles.orderBadge}>BLQ</span>
                      <div className={styles.eventTitle}>
                        <strong>{block.time}–{block.endTime} · {block.reason}</strong>
                        <small>{block.professionalName}</small>
                      </div>
                      <span className={styles.pill}>Bloqueado</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <p role="status" className={styles.muted}>Cargando la agenda…</p>
        )}
      </section>

      <div className={styles.shortcuts}>
        <section className={`${styles.card} ${styles.stack}`}>
          <h2>Pacientes</h2>
          <p className={styles.muted}>Consulta los datos de contacto y las fichas a tu cargo.</p>
          <Link className={styles.shortcutLink} href="/panel/pacientes">Ver pacientes</Link>
        </section>
        {staff.role !== "RECEPCION" && (
          <section className={`${styles.card} ${styles.stack}`}>
            <h2>Clínica</h2>
            <p className={styles.muted}>Consulta atenciones, odontograma y planes de tratamiento.</p>
            <Link className={styles.shortcutLink} href="/panel/clinica">Abrir clínica</Link>
          </section>
        )}
        {staff.role !== "ODONTOLOGO" && (
          <section className={`${styles.card} ${styles.stack}`}>
            <h2>Pagos</h2>
            <p className={styles.muted}>Registra abonos y revisa comprobantes pendientes.</p>
            <Link className={styles.shortcutLink} href="/panel/pagos">Abrir pagos</Link>
          </section>
        )}
        {staff.role !== "ODONTOLOGO" && (
          <section className={`${styles.card} ${styles.stack}`}>
            <h2>Mensajes</h2>
            <p className={styles.muted}>Recordatorios y plan futuro de Bot WhatsApp con IA local.</p>
            <Link className={styles.shortcutLink} href="/panel/mensajes">Abrir mensajes</Link>
          </section>
        )}
      </div>
    </div>
  );
}
