"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ClinicBrand } from "@/app/components/clinic-brand";
import { Gomita } from "@/app/reservar/gomita";
import {
  BookingError,
  appointmentDuration,
  appointmentHasStarted,
  bookingMessage,
  bookingRequest,
  calendarHref,
  postBooking,
  price,
  readableDate,
  reservationPath,
  slotKey,
  todayInLima,
  useSlots,
  type Appointment,
} from "@/app/reservar/reserva";
import { ScheduleFields } from "@/app/reservar/schedule-fields";
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
  const [professionalId, setProfessionalId] = useState("any");
  const [date, setDate] = useState(todayInLima);
  const [selection, setSelection] = useState("");
  const [notice, setNotice] = useState("");
  const dateInput = useRef<HTMLInputElement>(null);
  const url = reservationPath(token);
  const availability = useSlots(date, appointment?.serviceId ?? "", professionalId, rescheduling);
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
      let failure = cause;
      const latest = await bookingRequest<{ appointment: Appointment }>(url).catch((error: unknown) => {
        if (error instanceof BookingError && [404, 410].includes(error.status)) failure = error;
        return null;
      });
      if (latest) {
        setAppointment(latest.appointment);
        if (latest.appointment.status !== "CONFIRMED") setRescheduling(false);
      } else if (failure instanceof BookingError && [404, 410].includes(failure.status)) {
        setAppointment(null);
        setRescheduling(false);
        setNotFound(true);
      }
      if (action === "reschedule") {
        setSelection("");
        availability.refresh();
      }
      setError(bookingMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  function beginRescheduling() {
    if (!appointment) return;
    setError("");
    setNotice("");
    setSelection("");
    setProfessionalId(appointment.professionalId);
    setDate(appointment.date >= todayInLima() ? appointment.date : todayInLima());
    availability.refresh();
    setRescheduling(true);
  }

  function reschedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void update("reschedule");
  }

  const started = appointment ? appointmentHasStarted(appointment) : false;
  const canCancel = !started && (appointment?.status === "CONFIRMED" || appointment?.status === "PENDING");
  const canBookAgain = appointment?.status === "CANCELLED" || appointment?.status === "EXPIRED";
  const gomitaPose = notice === messages.confirm ? "exito" : rescheduling || busy ? "pensando" : "saludo";

  return (
    <main className={styles.page}>
      <ClinicBrand />
      <header className={`${styles.intro} ${styles.appointmentIntro}`}>
        <h1>Mi cita</h1>
        <Gomita pose={gomitaPose} compact />
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
                <div><dt>Duración estimada</dt><dd>{appointmentDuration(appointment)} min</dd></div>
                <div><dt>Precio referencial</dt><dd>{price(appointment.priceCents)}</dd></div>
                <div><dt>Referencia</dt><dd>{appointment.id}</dd></div>
              </dl>
              {notice && <p className={styles.notice} role="status">{notice}</p>}
              {error && <p className={styles.error} role="alert">{error}</p>}
              {canBookAgain && (
                <div className={styles.actions}>
                  <Link className={styles.primary} href="/reservar">Reservar otra cita</Link>
                </div>
              )}
              {started && (appointment.status === "PENDING" || appointment.status === "CONFIRMED") && (
                <p className={styles.notice}>La hora de inicio ya pasó. Puedes consultar tu cita mientras el enlace esté vigente.</p>
              )}
              {appointment.status === "PENDING" && !started && (
                <div className={styles.actions}>
                  <button className={styles.primary} type="button" disabled={busy} onClick={() => update("confirm")}>
                    {busy ? "Un momento…" : "Confirmar cita"}
                  </button>
                </div>
              )}
              {appointment.status === "CONFIRMED" && !started && !rescheduling && (
                <div className={styles.actions}>
                  <button className={styles.primary} type="button" disabled={busy} onClick={beginRescheduling}>
                    Elegir otro horario
                  </button>
                  <a className={styles.secondary} href={calendarHref(appointment)} download="cita-dental.ics">
                    Agregar al calendario
                  </a>
                </div>
              )}
              {appointment.status === "CONFIRMED" && !started && rescheduling && (
                <form className={styles.form} method="post" action={url} onSubmit={reschedule} aria-labelledby="move-heading">
                  <h3 id="move-heading">Nuevo horario</h3>
                  <p className={styles.muted}>Mantendremos tu cita actual hasta que guardes el nuevo horario.</p>
                  <div className={styles.field}>
                    <label htmlFor="change-professional">Profesional</label>
                    <select
                      id="change-professional"
                      name="professional"
                      disabled={busy}
                      value={professionalId}
                      onChange={(event) => {
                        setProfessionalId(event.target.value);
                        setSelection("");
                        setError("");
                      }}
                    >
                      <option value={appointment.professionalId}>{appointment.professionalName}</option>
                      <option value="any">Primer profesional disponible</option>
                    </select>
                  </div>
                  <ScheduleFields
                    date={date}
                    serviceId={appointment.serviceId}
                    professionalId={professionalId}
                    timeValue={selection}
                    availability={availability}
                    dateInputRef={dateInput}
                    dateLabel="Nueva fecha"
                    disabled={busy}
                    onDateChange={(nextDate) => {
                      setDate(nextDate);
                      setSelection("");
                      setError("");
                    }}
                    onSlotChange={(slot) => setSelection(slot ? slotKey(slot) : "")}
                  />
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
