"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { professionals } from "@/config/site";
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
  type Patient,
  type Status,
} from "./agenda/staff";
import styles from "./agenda/staff.module.css";

const activeQueueStatuses = new Set(["CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED"]);

function whatsappConfirmHref(appointment: Appointment) {
  const digits = (appointment.patientPhone ?? "").replace(/\D/g, "");
  if (!digits) return null;
  const intl = digits.length === 9 && digits.startsWith("9") ? `51${digits}` : digits;
  const msg = `Hola ${appointment.patientName}, te escribimos de Gómez Delgado Clínica Dental para recordarte tu cita de hoy (${dateLabel(appointment.date, true)}) a las ${appointment.time} (${appointment.serviceName} con ${appointment.professionalName}). ¿Nos confirmas tu asistencia? Si necesitas reprogramar o cancelar, por favor avísanos por este medio.`;
  return `https://wa.me/${intl}?text=${encodeURIComponent(msg)}`;
}

function telHref(phone?: string | null) {
  const digits = (phone ?? "").replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : null;
}

function minus30Label(time: string) {
  const [h, m] = time.split(":").map(Number);
  const total = Math.max(0, h * 60 + m - 30);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

const quickStatusOptions: { value: "ALL" | Status; label: string }[] = [
  { value: "ALL", label: "Todos" },
  { value: "CONFIRMED", label: "Programado / Confirmado" },
  { value: "CHECKED_IN", label: "En sala / sede" },
  { value: "IN_PROGRESS", label: "En atención" },
  { value: "COMPLETED", label: "Completado" },
  { value: "PENDING", label: "Retenido" },
];

export default function StaffDashboard() {
  const staff = useStaff();
  const [date] = useState(todayLima);
  const [agenda, setAgenda] = useState<Agenda | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [statusFilter, setStatusFilter] = useState<"ALL" | Status>("ALL");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [clock, setClock] = useState(() => Date.now());

  const profInfo = staff.professionalId
    ? professionals.find((item) => item.id === staff.professionalId)
    : null;

  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ date, days: "1", professionalId: staff.professionalId ?? "any" });
    Promise.all([
      staffFetch<Agenda>("/api/panel/agenda?" + query, { signal: controller.signal }),
      staffFetch<{ patients: Patient[] }>("/api/panel/pacientes", { signal: controller.signal }),
    ])
      .then(([agendaRes, patientsRes]) => {
        if (controller.signal.aborted) return;
        setAgenda(agendaRes);
        setPatients(patientsRes.patients ?? []);
      })
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
      setNotice("Recordatorio de 30 min al asistente marcado como gestionado.");
      setAttempt((v) => v + 1);
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setBusyId(null);
    }
  }

  async function updateStatus(appointmentId: string, status: Status, msg: string) {
    setBusyId(appointmentId);
    setNotice("");
    setError("");
    try {
      await postJson("/api/panel/agenda", { action: "status", appointmentId, status });
      setNotice(msg);
      setAttempt((v) => v + 1);
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setBusyId(null);
    }
  }

  async function cancelFromReminder(appointmentId: string) {
    setBusyId(appointmentId);
    setNotice("");
    setError("");
    try {
      await postJson("/api/panel/agenda", {
        action: "cancel",
        appointmentId,
        reason: "Cancelado al confirmar asistencia 30 min antes",
      });
      setConfirmCancelId(null);
      setNotice("Cita cancelada y horario liberado.");
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

  const filteredAppointments = statusFilter === "ALL"
    ? appointments
    : appointments.filter((appt) => appt.status === statusFilter);

  const confirmedToday = orderedQueue.filter((a) => a.status === "CONFIRMED");
  const reminderItems = confirmedToday.map((appt) => {
    const startMs = atLima(appt.date, appt.time).getTime();
    const minutesUntil = Math.round((startMs - clock) / 60_000);
    const inUrgentWindow = !appt.reminder30mSentAt && minutesUntil <= 35 && minutesUntil >= -15;
    return { appt, minutesUntil, inUrgentWindow };
  });

  const blocks = [...(agenda?.blocks ?? [])].sort((a, b) => a.time.localeCompare(b.time));
  const firstPatientId = orderedQueue[0]?.patientId ?? patients[0]?.id ?? "";

  return (
    <div className={styles.stack}>
      <header className={styles.intro}>
        <h1>Hola, {staff.name}</h1>
        <p>
          {profInfo ? `${profInfo.title} · ${profInfo.specialty}` : roleLabels[staff.role]}
          {" · "}
          {dateLabel(date)}
        </p>
      </header>

      {notice && <p className={styles.notice} role="status">{notice}</p>}

      {/* RECORDATORIO DEL SISTEMA AL ASISTENTE ENCARGADO (30 MIN ANTES) */}
      {staff.role !== "ODONTOLOGO" && (
        <section className={`${styles.card} ${styles.stack}`} aria-labelledby="reminders-30m-title">
          <div className={styles.row}>
            <div>
              <h2 id="reminders-30m-title">Confirmación de visita (30 min antes)</h2>
              <p className={styles.muted}>
                Recordatorio del sistema para el asistente encargado: llama o escribe al paciente 30 minutos antes para recordarle su cita y confirmar si podrá asistir.
              </p>
            </div>
            <Link className={styles.secondary} href="/panel/mensajes">Ver cola / Bot WhatsApp</Link>
          </div>

          {!agenda ? (
            <p className={styles.muted}>Revisando citas confirmadas de hoy…</p>
          ) : reminderItems.length === 0 ? (
            <p className={styles.muted}>No hay citas confirmadas pendientes de confirmación previa para hoy.</p>
          ) : (
            <div className={styles.stack}>
              {reminderItems.map(({ appt, minutesUntil, inUrgentWindow }) => {
                const waUrl = whatsappConfirmHref(appt);
                const phoneUrl = telHref(appt.patientPhone);
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
                            ? "Asistente contactó al paciente"
                            : inUrgentWindow
                              ? `¡Llamar o escribir ahora! (faltan ${Math.max(0, minutesUntil)} min)`
                              : minutesUntil > 35
                                ? `Avisar al asistente a las ${minus30Label(appt.time)} (30 min antes)`
                                : "Turno ya iniciado"}
                        </p>
                      </div>
                      {appt.reminder30mSentAt ? (
                        <span className={styles.reminderDoneBadge}>✓ Recordatorio enviado / Asistencia confirmada</span>
                      ) : confirmCancelId === appt.id ? (
                        <div className={styles.actions}>
                          <span className={styles.muted}>¿Liberar horario?</span>
                          <button
                            type="button"
                            className={styles.primary}
                            disabled={busyId === appt.id}
                            onClick={() => void cancelFromReminder(appt.id)}
                          >
                            {busyId === appt.id ? "Cancelando…" : "Sí, cancelar"}
                          </button>
                          <button
                            type="button"
                            className={styles.secondary}
                            disabled={busyId === appt.id}
                            onClick={() => setConfirmCancelId(null)}
                          >
                            Volver
                          </button>
                        </div>
                      ) : (
                        <div className={styles.actions}>
                          {phoneUrl && (
                            <a href={phoneUrl} className={styles.secondary}>
                              Llamar ({appt.patientPhone})
                            </a>
                          )}
                          {waUrl && (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.secondary}
                            >
                              Enviar recordatorio WhatsApp
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
                          <button
                            type="button"
                            className={styles.miniBtn}
                            disabled={busyId === appt.id}
                            onClick={() => setConfirmCancelId(appt.id)}
                          >
                            No asistirá / Cancelar
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

      {/* CARD DE ORDEN DE ATENCIÓN DEL DÍA */}
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
                          onClick={() => void updateStatus(appointment.id, "CHECKED_IN", "Paciente marcado en sala.")}
                        >
                          En sede
                        </button>
                      )}
                      {staff.role !== "RECEPCION" && (staff.role === "ADMIN" || appointment.patientAssigned !== false) && (
                        <Link className={styles.miniBtn} href={`/panel/clinica?paciente=${encodeURIComponent(appointment.patientId)}`}>
                          Ficha
                        </Link>
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
        {/* LISTADO DE VISTA RÁPIDA DE PACIENTES CON ESTADOS */}
        <section className={`${styles.card} ${styles.stack}`} aria-labelledby="quick-patients-title">
          <div className={styles.row}>
            <div>
              <h2 id="quick-patients-title">Pacientes · Vista rápida</h2>
              <p className={styles.muted}>Estado de citas de hoy y directorio directo.</p>
            </div>
            <Link className={styles.shortcutLink} href="/panel/pacientes">Ver directorio ({patients.length})</Link>
          </div>

          <div className={styles.quickChipRow} role="group" aria-label="Filtrar por estado">
            {quickStatusOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={statusFilter === opt.value}
                className={`${styles.chipBtn} ${statusFilter === opt.value ? styles.chipBtnActive : ""}`}
                onClick={() => setStatusFilter(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {filteredAppointments.length > 0 ? (
            <ul className={styles.recordList}>
              {filteredAppointments.map((appt) => (
                <li key={appt.id} className={styles.queueRow}>
                  <span className={styles.orderBadge}>{appt.time}</span>
                  <div className={styles.eventTitle}>
                    <strong>{appt.patientName}</strong>
                    <small>
                      {appt.serviceName} · {appt.professionalName}
                      {appt.patientPhone ? ` · ${appt.patientPhone}` : ""}
                    </small>
                  </div>
                  <div className={styles.actions}>
                    <span className={styles.pill} data-status={appt.status}>{statusLabels[appt.status]}</span>
                    {(staff.role === "ADMIN" || (staff.role === "ODONTOLOGO" && appt.patientAssigned !== false)) ? (
                      <Link
                        className={styles.miniBtn}
                        href={`/panel/clinica?paciente=${encodeURIComponent(appt.patientId)}`}
                      >
                        Abrir
                      </Link>
                    ) : (
                      <Link
                        className={styles.miniBtn}
                        href={`/panel/pacientes?paciente=${encodeURIComponent(appt.patientId)}`}
                      >
                        Ver
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <>
              <p className={styles.muted}>
                {appointments.length === 0
                  ? "Sin turnos hoy con ese estado. Acceso directo a pacientes registrados:"
                  : "No hay pacientes hoy con el estado seleccionado."}
              </p>
              {patients.length > 0 && statusFilter === "ALL" && (
                <ul className={styles.recordList}>
                  {patients.slice(0, 5).map((patient) => (
                    <li key={patient.id} className={styles.queueRow}>
                      <span className={styles.orderBadge}>PAC</span>
                      <div className={styles.eventTitle}>
                        <strong>{patient.name}</strong>
                        <small>{patient.phone}{patient.dni ? ` · DNI ${patient.dni}` : ""}</small>
                      </div>
                      <div className={styles.actions}>
                        <span className={styles.pill}>Registrado</span>
                        <Link
                          className={styles.miniBtn}
                          href={staff.role !== "RECEPCION"
                            ? `/panel/clinica?paciente=${encodeURIComponent(patient.id)}`
                            : `/panel/pacientes?paciente=${encodeURIComponent(patient.id)}`}
                        >
                          Ficha
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>

        {/* CLÍNICA CON BOTONES RÁPIDOS */}
        {staff.role !== "RECEPCION" ? (
          <section className={`${styles.card} ${styles.stack}`} aria-labelledby="quick-clinic-title">
            <div className={styles.row}>
              <div>
                <h2 id="quick-clinic-title">Clínica · Accesos rápidos</h2>
                <p className={styles.muted}>Atajos directos al llenado, odontograma y visualización.</p>
              </div>
              <Link className={styles.shortcutLink} href="/panel/clinica">Abrir clínica</Link>
            </div>
            <div className={styles.quickActionGrid}>
              <Link
                className={styles.quickActionCardBtn}
                href={firstPatientId ? `/panel/clinica?paciente=${encodeURIComponent(firstPatientId)}` : "/panel/clinica"}
              >
                Llenar Historia Clínica
                <span>Modo 1 · Anamnesis y examen</span>
              </Link>
              <Link
                className={styles.quickActionCardBtn}
                href={firstPatientId ? `/panel/clinica?paciente=${encodeURIComponent(firstPatientId)}&paso=odontograma` : "/panel/clinica"}
              >
                Odontograma (NTS 188)
                <span>Inicial y Final interactivos</span>
              </Link>
              <Link
                className={styles.quickActionCardBtn}
                href={firstPatientId ? `/panel/clinica?paciente=${encodeURIComponent(firstPatientId)}&modo=view` : "/panel/clinica"}
              >
                Visualizar Datos / PDF
                <span>Modo 2 · Ficha completa e impresión</span>
              </Link>
              <Link
                className={styles.quickActionCardBtn}
                href={firstPatientId ? `/panel/clinica?paciente=${encodeURIComponent(firstPatientId)}&paso=presupuesto` : "/panel/clinica"}
              >
                Presupuesto y Consentimiento
                <span>Costos, abonos y GD DENTAL</span>
              </Link>
            </div>
          </section>
        ) : null}

        {staff.role !== "ODONTOLOGO" && (
          <section className={`${styles.card} ${styles.stack}`}>
            <h2>Citas y doctores</h2>
            <p className={styles.muted}>Tabla unificada de citas, pacientes y odontólogos asignados.</p>
            <Link className={styles.shortcutLink} href="/panel/citas">Abrir tabla de citas</Link>
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
