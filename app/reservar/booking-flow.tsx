"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ClinicBrand } from "@/app/components/clinic-brand";
import {
  BookingError,
  appointmentDuration,
  bookingMessage,
  bookingRequest,
  calendarHref,
  postBooking,
  price,
  readableDate,
  reservationPath,
  slotKey,
  todayInLima,
  useHoldClock,
  useSlots,
  type Appointment,
  type Catalog,
  type Hold,
  type Slot,
} from "./reserva";
import styles from "./booking.module.css";
import { Gomita } from "./gomita";
import { ScheduleFields } from "./schedule-fields";

type Step = "service" | "schedule" | "contact" | "review" | "confirmed";
type Contact = { name: string; phone: string; email: string; whatsappOptIn: boolean };

const progress = {
  service: { title: "Servicio", position: 1 },
  schedule: { title: "Horario", position: 2 },
  contact: { title: "Confirmación", position: 3 },
  review: { title: "Confirmación", position: 3 },
};

const emptyContact: Contact = { name: "", phone: "", email: "", whatsappOptIn: false };

function ScheduleSummary({
  date,
  time,
  professionalName,
  serviceName,
  priceCents,
  endTime,
  location,
}: Pick<Appointment, "date" | "time" | "endTime" | "professionalName" | "serviceName" | "priceCents">
  & { location: string }) {
  return (
    <dl className={styles.details}>
      <div><dt>Servicio</dt><dd>{serviceName}</dd></div>
      <div><dt>Profesional</dt><dd>{professionalName}</dd></div>
      <div><dt>Horario en Lima</dt><dd>{readableDate(date)} a las {time}</dd></div>
      <div><dt>Duración estimada</dt><dd>{appointmentDuration({ date, time, endTime })} min</dd></div>
      <div><dt>Ubicación</dt><dd>{location}</dd></div>
      <div><dt>Precio referencial</dt><dd>{price(priceCents)}</dd></div>
    </dl>
  );
}

export default function BookingFlow({
  catalog,
  initialServiceId,
  location,
}: {
  catalog: Catalog;
  initialServiceId: string;
  location: string;
}) {
  const [step, setStep] = useState<Step>("service");
  const [serviceId, setServiceId] = useState(initialServiceId);
  const [professionalId, setProfessionalId] = useState("any");
  const [date, setDate] = useState(todayInLima);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [contact, setContact] = useState<Contact>(emptyContact);
  const [hold, setHold] = useState<Hold | null>(null);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(step);
  const reservationAttempt = useRef<{ payload: string; key: string } | null>(null);
  const service = catalog.services.find((item) => item.id === serviceId);
  const professionals = catalog.professionals.filter((item) => item.serviceIds.includes(serviceId));
  const availability = useSlots(date, serviceId, professionalId, step === "schedule");
  const remaining = useHoldClock(step === "review" ? hold?.expiresAt : undefined);
  const expired = remaining === 0;

  useEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    heading.current?.focus();
  }, [step]);

  function go(next: Step) {
    setError("");
    setStep(next);
  }

  function changeSlot(message = "") {
    reservationAttempt.current = null;
    setHold(null);
    setSelectedSlot(null);
    setError(message);
    availability.refresh();
    setStep("schedule");
  }

  async function reserve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSlot || !service || busy) return;
    setBusy(true);
    setError("");
    try {
      const data = {
        serviceId: service.id,
        date: selectedSlot.date,
        time: selectedSlot.time,
        professionalId: selectedSlot.professionalId,
        name: contact.name.trim(),
        phone: contact.phone.trim(),
        email: contact.email.trim() || undefined,
        whatsappOptIn: contact.whatsappOptIn,
      };
      const payload = JSON.stringify(data);
      if (reservationAttempt.current?.payload !== payload) {
        reservationAttempt.current = { payload, key: crypto.randomUUID() };
      }
      const result = await postBooking<Hold>("/api/reservas", data, reservationAttempt.current.key);
      setHold(result);
      if (result.appointment.status === "CONFIRMED") {
        setAppointment(result.appointment);
        go("confirmed");
      } else {
        go("review");
      }
    } catch (cause) {
      if (cause instanceof BookingError && [409, 410].includes(cause.status)) changeSlot(cause.message);
      else setError(bookingMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function releaseHold() {
    if (!hold || busy) return;
    if (expired) {
      changeSlot("Tu turno venció. Elige un horario nuevo para continuar.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await postBooking(reservationPath(hold.token), { action: "cancel" });
      changeSlot();
    } catch (cause) {
      if (cause instanceof BookingError && [404, 410].includes(cause.status)) {
        changeSlot("Tu turno ya no está disponible. Elige un horario nuevo.");
      } else {
        setError(bookingMessage(cause));
      }
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!hold || busy || expired) return;
    setBusy(true);
    setError("");
    const url = reservationPath(hold.token);
    try {
      const result = await postBooking<{ appointment: Appointment }>(url, { action: "confirm" });
      setAppointment(result.appointment);
      go("confirmed");
    } catch (cause) {
      // A failed response may follow a committed confirmation. Recover that result before retrying.
      const latest = await bookingRequest<{ appointment: Appointment }>(url).catch(() => null);
      if (latest?.appointment.status === "CONFIRMED") {
        setAppointment(latest.appointment);
        go("confirmed");
      } else if (
        latest?.appointment.status === "EXPIRED" ||
        (cause instanceof BookingError && cause.status === 410)
      ) {
        changeSlot("Tu turno venció. Elige un horario nuevo para continuar.");
      } else {
        setError(bookingMessage(cause));
      }
    } finally {
      setBusy(false);
    }
  }

  const markedSlot = availability.slots.find(
    (slot) => selectedSlot && slotKey(slot) === slotKey(selectedSlot) && slot.date === selectedSlot.date,
  );
  const activeProgress = step === "confirmed" ? null : progress[step];

  return (
    <main className={styles.page}>
      <ClinicBrand />
      <header className={styles.intro}>
        <h1>Reserva tu cita</h1>
        <p>Elige un servicio y un horario que te acomode.</p>
      </header>
      <div className={styles.grid}>
        <section className={styles.card} aria-label="Reserva">
          {activeProgress && (
            <div className={styles.progress}>
              <p>Paso {activeProgress.position} de 3 · {activeProgress.title}</p>
              <progress aria-label="Progreso de la reserva" value={activeProgress.position} max={3} />
            </div>
          )}
          <div className={styles.stage} key={step}>
            {step === "service" && (
              <>
                <h2 tabIndex={-1} ref={heading}>¿Qué servicio necesitas?</h2>
                <label className={styles.field}>
                  Servicio
                  <select
                    value={serviceId}
                    aria-describedby={service ? "service-hint" : undefined}
                    onChange={(event) => {
                      setServiceId(event.target.value);
                      setProfessionalId("any");
                      setSelectedSlot(null);
                    }}
                  >
                    <option value="">Selecciona un servicio</option>
                    {catalog.services.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>
                {service && (
                  <>
                    <p className={styles.muted} id="service-hint">
                      {service.duration} min · {price(service.priceCents)} referencial
                    </p>
                    <details className={styles.disclosure}>
                      <summary>Preferencia de profesional</summary>
                      <label className={styles.field}>
                        Profesional
                        <select
                          value={professionalId}
                          onChange={(event) => {
                            setProfessionalId(event.target.value);
                            setSelectedSlot(null);
                          }}
                        >
                          <option value="any">Primer profesional disponible</option>
                          {professionals.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </select>
                      </label>
                    </details>
                  </>
                )}
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.primary}
                    disabled={!service}
                    onClick={() => {
                      availability.refresh();
                      go("schedule");
                    }}
                  >
                    Ver horarios
                  </button>
                </div>
              </>
            )}
            {step === "schedule" && (
              <>
                <h2 tabIndex={-1} ref={heading}>Elige la fecha y la hora</h2>
                {service && <p className={styles.muted}>{service.name} · {service.duration} min · {location}</p>}
                <ScheduleFields
                  date={date}
                  serviceId={serviceId}
                  professionalId={professionalId}
                  timeValue={markedSlot ? slotKey(markedSlot) : ""}
                  availability={availability}
                  onDateChange={(nextDate) => {
                    setDate(nextDate);
                    setSelectedSlot(null);
                    setError("");
                  }}
                  onSlotChange={setSelectedSlot}
                />
                {error && <p className={styles.notice} role="status">{error}</p>}
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.primary}
                    disabled={!markedSlot}
                    onClick={() => go("contact")}
                  >
                    Continuar
                  </button>
                  <button type="button" className={styles.simpleButton} onClick={() => go("service")}>
                    Cambiar servicio o profesional
                  </button>
                </div>
              </>
            )}
            {step === "contact" && service && selectedSlot && (
              <>
                <h2 tabIndex={-1} ref={heading}>Tus datos de contacto</h2>
                <p>{readableDate(selectedSlot.date)} a las {selectedSlot.time} · {service.name}</p>
                <p className={styles.notice}>
                  Estás en una demostración. Usa datos ficticios.{" "}
                  <Link href="/privacidad" target="_blank" rel="noreferrer" className={styles.simpleButton}>
                    Privacidad de la demostración (otra pestaña)
                  </Link>
                </p>
                <form className={styles.form} method="post" action="/api/reservas" onSubmit={reserve} autoComplete="off">
                  <label className={styles.field} htmlFor="booking-name">
                    Nombre completo
                    <input
                      id="booking-name"
                      name="name"
                      required
                      minLength={2}
                      maxLength={100}
                      enterKeyHint="next"
                      value={contact.name}
                      onChange={(event) => setContact({ ...contact, name: event.target.value })}
                    />
                  </label>
                  <div className={styles.row}>
                    <label className={styles.field} htmlFor="booking-phone">
                      Teléfono
                      <input
                        id="booking-phone"
                        name="phone"
                        required
                        type="tel"
                        minLength={7}
                        maxLength={22}
                        enterKeyHint="next"
                        value={contact.phone}
                        onChange={(event) => setContact({ ...contact, phone: event.target.value })}
                        placeholder="+51 900 000 000"
                      />
                    </label>
                    <label className={styles.field} htmlFor="booking-email">
                      Correo opcional
                      <input
                        id="booking-email"
                        name="email"
                        type="email"
                        maxLength={160}
                        autoCapitalize="none"
                        enterKeyHint="done"
                        spellCheck={false}
                        value={contact.email}
                        onChange={(event) => setContact({ ...contact, email: event.target.value })}
                      />
                    </label>
                  </div>
                  <label className={styles.checkbox} htmlFor="booking-whatsapp">
                    <input
                      id="booking-whatsapp"
                      name="whatsappOptIn"
                      type="checkbox"
                      checked={contact.whatsappOptIn}
                      onChange={(event) => setContact({ ...contact, whatsappOptIn: event.target.checked })}
                    />
                    Acepto recibir confirmaciones y recordatorios por WhatsApp.
                  </label>
                  {error && <p className={styles.error} role="alert">{error}</p>}
                  <div className={styles.actions}>
                    <button type="submit" className={styles.primary} disabled={busy}>
                      {busy ? "Guardando el horario…" : "Revisar la reserva"}
                    </button>
                    <button
                      type="button"
                      className={styles.simpleButton}
                      disabled={busy}
                      onClick={() => {
                        availability.refresh();
                        go("schedule");
                      }}
                    >
                      Cambiar horario
                    </button>
                  </div>
                </form>
              </>
            )}
            {step === "review" && hold && (
              <>
                <h2 tabIndex={-1} ref={heading}>Revisa tu cita</h2>
                <ScheduleSummary {...hold.appointment} location={location} />
                <p><strong>{hold.appointment.patientName}</strong></p>
                {expired ? (
                  <p className={styles.notice} role="status">Tu turno venció. Tus datos están listos para elegir otro horario.</p>
                ) : (
                  <p className={styles.notice}>
                    Horario retenido por{" "}
                    <strong role="timer">
                      {remaining === null ? "…" : `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`}
                    </strong>{" "}
                    min. Tu cita se registra al confirmar.
                  </p>
                )}
                {error && <p className={styles.error} role="alert">{error}</p>}
                <div className={styles.actions}>
                  <button type="button" className={styles.primary} disabled={busy || remaining === null} onClick={expired ? releaseHold : confirm}>
                    {busy ? "Un momento…" : expired ? "Elegir otro horario" : "Confirmar cita"}
                  </button>
                  {!expired && (
                    <button type="button" className={styles.simpleButton} disabled={busy} onClick={releaseHold}>
                      Cambiar horario
                    </button>
                  )}
                </div>
              </>
            )}
            {step === "confirmed" && hold && appointment && (
              <>
                <h2 tabIndex={-1} ref={heading}>Tu cita quedó confirmada</h2>
                <ScheduleSummary {...appointment} location={location} />
                <p className={styles.reference}><strong>Referencia</strong> {appointment.id}</p>
                <p className={styles.muted}>
                  Guarda el enlace personal. Puedes reprogramar o cancelar antes de la hora de inicio.
                </p>
                <div className={styles.actions}>
                  <Link className={styles.primary} href={`/mi-cita/${encodeURIComponent(hold.token)}`}>
                    Ver mi cita
                  </Link>
                  <a className={styles.secondary} href={calendarHref(appointment)} download="cita-dental.ics">
                    Agregar al calendario
                  </a>
                </div>
              </>
            )}
          </div>
        </section>
        <Gomita pose={step === "service" ? "saludo" : step === "confirmed" ? "exito" : "pensando"} />
      </div>
    </main>
  );
}
