"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  BookingError,
  bookingMessage,
  bookingRequest,
  postBooking,
  price,
  readableDate,
  reservationPath,
  slotKey,
  todayInLima,
  useSlots,
  type Appointment,
} from "@/app/reservar/reserva";
import styles from "@/app/reservar/booking.module.css";

const statuses: Record<Appointment["status"], string> = {
  PENDING: "Pendiente de confirmación",
  CONFIRMED: "Confirmada",
  CANCELLED: "Cancelada",
  EXPIRED: "Vencida",
  RESCHEDULED: "Reprogramada",
  CHECKED_IN: "En recepción",
  IN_PROGRESS: "En atención",
  COMPLETED: "Atendida",
  NO_SHOW: "Sin asistencia",
};

type Action = "confirm" | "cancel" | "reschedule";

const messages: Record<Action, string> = {
  confirm: "Tu cita quedó confirmada.",
  cancel: "Tu cita quedó cancelada.",
  reschedule: "Tu cita quedó reprogramada.",
};

export default function AppointmentManagement({ token }: { token: string }) {
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [date, setDate] = useState(todayInLima);
  const [selection, setSelection] = useState("");
  const [notice, setNotice] = useState("");
  const dateInput = useRef<HTMLInputElement>(null);
  const url = reservationPath(token);
  const availability = useSlots(date, appointment?.serviceId ?? "", "any", rescheduling);
  const selectedSlot = availability.slots.find((item) => slotKey(item) === selection);

  useEffect(() => {
    const controller = new AbortController();
    bookingRequest<{ appointment: Appointment }>(url, { signal: controller.signal })
      .then(({ appointment }) => {
        if (!controller.signal.aborted) setAppointment(appointment);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(bookingMessage(cause));
        setNotFound(cause instanceof BookingError && [404, 410].includes(cause.status));
      });
    return () => controller.abort();
  }, [url, attempt]);

  useEffect(() => {
    if (rescheduling) dateInput.current?.focus();
  }, [rescheduling]);

  async function update(action: Action) {
    if (!appointment || busy || (action === "reschedule" && !selectedSlot)) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { appointment: updated } = await postBooking<{ appointment: Appointment }>(url, {
        action,
        ...selectedSlot && action === "reschedule"
          ? { date: selectedSlot.date, time: selectedSlot.time, professionalId: selectedSlot.professionalId }
          : {},
      });
      setAppointment(updated);
      setRescheduling(false);
      setNotice(messages[action]);
    } catch (cause) {
      // Another tab may have changed this appointment while the action was in progress.
      const latest = await bookingRequest<{ appointment: Appointment }>(url).catch(() => null);
      if (latest) {
        setAppointment(latest.appointment);
        if (latest.appointment.status !== "CONFIRMED") setRescheduling(false);
      }
      if (action === "reschedule") {
        setSelection("");
        availability.refresh();
      }
      setError(bookingMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  function beginRescheduling() {
    if (!appointment) return;
    setError("");
    setNotice("");
    setSelection("");
    setDate(appointment.date >= todayInLima() ? appointment.date : todayInLima());
    availability.refresh();
    setRescheduling(true);
  }

  function reschedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void update("reschedule");
  }

  const canCancel = appointment?.status === "CONFIRMED" || appointment?.status === "PENDING";
  const canBookAgain = appointment?.status === "CANCELLED" || appointment?.status === "EXPIRED";

  return (
    <main className={styles.page}>
      <Link className={styles.exitLink} href="/">Volver al inicio</Link>
      <header className={styles.intro}>
        <h1>Mi cita</h1>
      </header>
      <section className={`${styles.card} ${styles.single}`} aria-label="Gestión de la cita">
        <div className={styles.stage}>
          {!appointment && !error && <p role="status">Consultando tu cita…</p>}
          {!appointment && error && (
            <>
              <p className={styles.error} role="alert">{error}</p>
              <div className={styles.actions}>
                {notFound ? (
                  <Link className={styles.primary} href="/reservar">Reservar una cita</Link>
                ) : (
                  <button
                    className={styles.primary}
                    type="button"
                    onClick={() => {
                      setError("");
                      setAttempt((value) => value + 1);
                    }}
                  >
                    Consultar otra vez
                  </button>
                )}
              </div>
            </>
          )}
          {appointment && (
            <>
              <h2>{appointment.serviceName}</h2>
              <p className={styles.muted}>{statuses[appointment.status]}</p>
              <dl className={styles.details}>
                <div><dt>Horario en Lima</dt><dd>{readableDate(appointment.date)} a las {appointment.time}</dd></div>
                <div><dt>Profesional</dt><dd>{appointment.professionalName}</dd></div>
                <div><dt>Paciente</dt><dd>{appointment.patientName}</dd></div>
                <div><dt>Precio referencial</dt><dd>{price(appointment.priceCents)}</dd></div>
              </dl>
              {notice && <p className={styles.notice} role="status">{notice}</p>}
              {error && <p className={styles.error} role="alert">{error}</p>}
              {canBookAgain && (
                <div className={styles.actions}>
                  <Link className={styles.primary} href="/reservar">Reservar otra cita</Link>
                </div>
              )}
              {appointment.status === "PENDING" && (
                <div className={styles.actions}>
                  <button className={styles.primary} type="button" disabled={busy} onClick={() => update("confirm")}>
                    {busy ? "Un momento…" : "Confirmar cita"}
                  </button>
                </div>
              )}
              {appointment.status === "CONFIRMED" && !rescheduling && (
                <div className={styles.actions}>
                  <button className={styles.primary} type="button" disabled={busy} onClick={beginRescheduling}>
                    Elegir otro horario
                  </button>
                </div>
              )}
              {appointment.status === "CONFIRMED" && rescheduling && (
                <form className={styles.form} onSubmit={reschedule}>
                  <div className={styles.row}>
                    <label className={styles.field}>
                      Nueva fecha
                      <input
                        ref={dateInput}
                        type="date"
                        min={todayInLima()}
                        required
                        value={date}
                        disabled={busy}
                        onChange={(event) => {
                          setDate(event.target.value);
                          setSelection("");
                        }}
                      />
                    </label>
                    <label className={styles.field}>
                      Hora de Lima
                      <select
                        value={selection}
                        disabled={busy || availability.loading || !availability.slots.length}
                        onChange={(event) => setSelection(event.target.value)}
                      >
                        <option value="">{availability.loading ? "Buscando horas…" : "Selecciona una hora"}</option>
                        {availability.slots.map((item) => (
                          <option key={slotKey(item)} value={slotKey(item)}>
                            {item.time} · {item.professionalName}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {availability.error && (
                    <>
                      <p className={styles.error} role="alert">{availability.error}</p>
                      <button className={styles.simpleButton} type="button" onClick={availability.refresh}>Buscar otra vez</button>
                    </>
                  )}
                  {!availability.loading && !availability.error && date && !availability.slots.length && (
                    <p className={styles.notice}>No quedan horarios para esa fecha. Prueba otro día.</p>
                  )}
                  <div className={styles.actions}>
                    <button className={styles.primary} type="submit" disabled={!selectedSlot || busy}>
                      {busy ? "Guardando…" : "Guardar nuevo horario"}
                    </button>
                    <button
                      className={styles.simpleButton}
                      type="button"
                      disabled={busy}
                      onClick={() => setRescheduling(false)}
                    >
                      Mantener mi cita
                    </button>
                  </div>
                </form>
              )}
              {canCancel && !rescheduling && (
                <details className={styles.disclosure}>
                  <summary>Cancelar cita</summary>
                  <p className={styles.muted}>Al confirmar, el horario quedará disponible para otra reserva.</p>
                  <button className={styles.secondary} type="button" disabled={busy} onClick={() => update("cancel")}>
                    {busy ? "Un momento…" : "Confirmar cancelación"}
                  </button>
                </details>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
