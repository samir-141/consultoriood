"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ClinicBrand } from "@/app/components/clinic-brand";
import { PublicIcon } from "@/app/components/public-icon";
import {
  BookingError,
  bookingMessage,
  calendarHref,
  postBooking,
  price,
  readableDate,
  reservationPath,
  slotKey,
  todayInLima,
  useHoldClock,
  useMonthAvailability,
  useSlots,
  type Appointment,
  type Catalog,
  type Hold,
  type MonthlyAvailability,
  type Slot,
} from "./reserva";
import { CalendarPicker } from "./calendar-picker";
import styles from "./booking.module.css";

// 4 pasos obligatorios del nuevo flujo:
// 1. Elegir día en calendario
// 2. Ver horarios disponibles de ese día
// 3. Completar datos del paciente
// 4. Pantalla de confirmación con el resumen
type BookingStep = 1 | 2 | 3 | 4;

type PatientForm = {
  name: string;
  phone: string;
  dni: string;
  email: string;
  reason: string;
  whatsappOptIn: boolean;
};

const emptyForm: PatientForm = {
  name: "",
  phone: "",
  dni: "",
  email: "",
  reason: "",
  whatsappOptIn: true,
};

export default function BookingFlow({
  catalog,
  initialServiceId,
  location,
  initialMonthData = null,
}: {
  catalog: Catalog;
  initialServiceId: string;
  location: string;
  initialMonthData?: MonthlyAvailability | null;
}) {
  const [step, setStep] = useState<BookingStep>(1);

  // Auto-asignación condicional de Servicio
  const defaultServiceId =
    initialServiceId || (catalog.services.length > 0 ? catalog.services[0].id : "");
  const [serviceId, setServiceId] = useState(defaultServiceId);

  // Auto-asignación condicional de Doctor:
  // Si hay un solo doctor, no muestres selector de doctor (asígnalo automáticamente)
  const singleDoctor = catalog.professionals.length === 1;
  const defaultProfessionalId = singleDoctor ? catalog.professionals[0].id : "any";
  const [professionalId, setProfessionalId] = useState(defaultProfessionalId);

  // Fecha seleccionada y mes visible en calendario
  const todayStr = todayInLima();
  const [visibleMonth, setVisibleMonth] = useState(() => todayStr.slice(0, 7));
  const [manualDate, setManualDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  // Disponibilidad mensual en tiempo real (detecta días llenos, regla de 15 min y consultas presenciales)
  const monthHook = useMonthAvailability(visibleMonth, serviceId, professionalId, initialMonthData);
  const monthDays = monthHook.data?.days;

  // Resolver la fecha activa: si el día actual o manual no es reservable en ese mes, saltar al próximo día con cupo
  const date =
    manualDate && monthDays?.[manualDate]?.reservable !== false
      ? manualDate
      : monthHook.data?.nextAvailableDate ?? manualDate ?? todayStr;

  const selectedDayState = monthDays?.[date];
  const isSelectedDateBlocked = Boolean(selectedDayState && !selectedDayState.reservable);

  // Slots del backend mediante hook reactivo useSlots
  const slotsHook = useSlots(date, serviceId, professionalId, step === 2);
  const availableSlots = slotsHook.slots;
  const slotsLoading = slotsHook.loading;
  const slotsError = slotsHook.error;

  // Formulario del paciente
  const [patient, setPatient] = useState<PatientForm>(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Cita creada
  const [hold, setHold] = useState<Hold | null>(null);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");

  const headingRef = useRef<HTMLHeadingElement>(null);
  const reservationAttempt = useRef<{ payload: string; key: string } | null>(null);

  const currentService = catalog.services.find((s) => s.id === serviceId) ?? catalog.services[0];
  const assignedDoctor = catalog.professionals.find((p) => p.id === professionalId) ?? catalog.professionals[0];

  const remaining = useHoldClock(step === 4 && hold?.appointment?.status === "PENDING" ? hold?.expiresAt : undefined);

  // Focus accesible al cambiar de paso
  useEffect(() => {
    headingRef.current?.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  // Navegar entre pasos
  function goToStep(next: BookingStep) {
    setServerError("");
    setStep(next);
  }

  // Validación en cliente del Paso 3
  function validatePatientClient(): boolean {
    const errors: Record<string, string> = {};
    if (!patient.name.trim() || patient.name.trim().length < 2) {
      errors.name = "Por favor ingresa tu nombre y apellido (mínimo 2 caracteres).";
    }
    const phoneOrDni = patient.phone.trim();
    if (!phoneOrDni || phoneOrDni.length < 6) {
      errors.phone = "Por favor ingresa tu teléfono o DNI de contacto.";
    }
    if (patient.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patient.email.trim())) {
      errors.email = "Ingresa un correo electrónico válido o déjalo en blanco.";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // Enviar reserva (Paso 3 -> Paso 4)
  async function handleSubmitBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSlot || !currentService || submitting) return;

    if (!validatePatientClient()) return;

    setSubmitting(true);
    setServerError("");

    try {
      const data = {
        serviceId: currentService.id,
        date: selectedSlot.date,
        time: selectedSlot.time,
        professionalId: selectedSlot.professionalId,
        name: patient.name.trim(),
        phone: patient.phone.trim(),
        dni: patient.dni.trim() || (patient.phone.trim().length === 8 ? patient.phone.trim() : undefined),
        email: patient.email.trim() || undefined,
        reason: patient.reason.trim() || undefined,
        whatsappOptIn: patient.whatsappOptIn,
      };

      const payload = JSON.stringify(data);
      if (reservationAttempt.current?.payload !== payload) {
        reservationAttempt.current = { payload, key: crypto.randomUUID() };
      }

      const result = await postBooking<Hold>("/api/reservas", data, reservationAttempt.current.key);
      setHold(result);
      setAppointment(result.appointment);
      goToStep(4);
    } catch (err) {
      if (err instanceof BookingError && (err.status === 409 || err.status === 410)) {
        setServerError(bookingMessage(err));
        setSelectedSlot(null);
        monthHook.refresh();
        slotsHook.refresh();
        goToStep(2);
      } else {
        setServerError(bookingMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  }

  // Confirmar cita desde pantalla de confirmación
  async function handleConfirmBooking() {
    if (!hold || submitting) return;
    setSubmitting(true);
    setServerError("");
    const url = reservationPath(hold.token);
    try {
      const res = await postBooking<{ appointment: Appointment }>(url, { action: "confirm" });
      setAppointment(res.appointment);
    } catch (err) {
      setServerError(bookingMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  // Agrupamiento de turnos para el Paso 2
  const morningSlots = availableSlots.filter((s) => s.time < "12:00");
  const afternoonSlots = availableSlots.filter((s) => s.time >= "12:00");

  return (
    <main className={styles.page}>
      <header className={styles.flowHeader}>
        <ClinicBrand />
        <Link href="/" className={styles.backHomeLink}>
          Volver a la portada
        </Link>
      </header>

      {/* Indicador de 4 pasos */}
      <nav aria-label="Progreso de reserva" className={styles.stepProgressContainer}>
        <ol className={styles.stepProgressList}>
          {[
            { num: 1, label: "Elegir día" },
            { num: 2, label: "Horarios" },
            { num: 3, label: "Tus datos" },
            { num: 4, label: "Confirmación" },
          ].map(({ num, label }) => (
            <li
              key={num}
              className={`${styles.stepProgressItem} ${
                step === num ? styles.stepActive : step > num ? styles.stepDone : ""
              }`}
            >
              <span className={styles.stepBadge}>
                {step > num ? "✓" : num}
              </span>
              <span className={styles.stepLabel}>{label}</span>
            </li>
          ))}
        </ol>
      </nav>

      <div className={styles.flowContainer}>
        {/* PASO 1: ELEGIR DÍA EN UN CALENDARIO */}
        {step === 1 && (
          <section className={styles.stepCard} aria-labelledby="step-1-heading">
            <h1 id="step-1-heading" tabIndex={-1} ref={headingRef} className={styles.stepTitle}>
              Paso 1: Elige el día en el calendario
            </h1>
            <p className={styles.stepSubtitle}>
              Selecciona una fecha disponible para tu atención. Los días sin horarios disponibles, domingos y fechas pasadas están deshabilitados.
            </p>

            {/* Regla condicional: Selector de servicio solo si hay más de uno */}
            {catalog.services.length > 1 ? (
              <div className={styles.selectorBlock}>
                <label htmlFor="service-select" className={styles.selectorLabel}>
                  Tratamiento o servicio:
                </label>
                <select
                  id="service-select"
                  value={serviceId}
                  onChange={(e) => setServiceId(e.target.value)}
                  className={styles.selectInput}
                >
                  {catalog.services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.duration} min · {price(s.priceCents)})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className={styles.autoAssignedNotice}>
                Servicio: <strong>{currentService.name}</strong> ({currentService.duration} min)
              </div>
            )}

            {/* Regla condicional: Selector de doctor solo si hay más de uno */}
            {catalog.professionals.length > 1 ? (
              <div className={styles.selectorBlock}>
                <label htmlFor="doctor-select" className={styles.selectorLabel}>
                  Odontólogo de preferencia:
                </label>
                <select
                  id="doctor-select"
                  value={professionalId}
                  onChange={(e) => setProfessionalId(e.target.value)}
                  className={styles.selectInput}
                >
                  <option value="any">Primer profesional disponible</option>
                  {catalog.professionals.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.title})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className={styles.autoAssignedNotice}>
                <PublicIcon name="professional" />
                <span>
                  Profesional: <strong>{assignedDoctor.name}</strong> ({assignedDoctor.title})
                </span>
              </div>
            )}

            {/* Calendario con fechas pasadas, domingos y días sin cupo deshabilitados */}
            <div className={styles.calendarWrapper}>
              <CalendarPicker
                selectedDate={date}
                dayStates={monthDays}
                loadingMonth={monthHook.loading}
                onMonthChange={(m) => setVisibleMonth(m)}
                onSelectDate={(newDate) => {
                  setManualDate(newDate);
                  setSelectedSlot(null);
                  if (newDate && newDate.length >= 7) {
                    setVisibleMonth(newDate.slice(0, 7));
                  }
                }}
              />
            </div>

            {isSelectedDateBlocked ? (
              <div className={styles.errorAlert}>
                El día seleccionado ya no tiene horarios web disponibles y no es reservable. Elige otra fecha en el calendario.
              </div>
            ) : (
              <div className={styles.selectedDateBanner}>
                Fecha seleccionada: <strong>{readableDate(date)}</strong>
                {selectedDayState && selectedDayState.availableCount > 0 && (
                  <span> · {selectedDayState.availableCount} horarios disponibles</span>
                )}
              </div>
            )}

            <div className={styles.walkInBanner}>
              <PublicIcon name="clock" />
              <div>
                <strong>
                  {monthHook.data?.todayStatus === "CUTOFF_WALKIN"
                    ? "Hoy: se aceptan consultas presenciales (con posible espera)"
                    : "Reservas web con 15 min de anticipación"}
                </strong>
                <span>
                  {monthHook.data?.walkInMessage ||
                    "Toda reserva en línea debe realizarse al menos 15 minutos antes del horario previsto. Si pasas ese margen dentro del horario de atención, se aceptan consultas presenciales en el consultorio (con posible espera)."}
                </span>
              </div>
            </div>

            <div className={styles.actionRow}>
              <button
                type="button"
                className="button"
                disabled={isSelectedDateBlocked || !date}
                onClick={() => goToStep(2)}
              >
                Ver horarios disponibles <PublicIcon name="arrow" />
              </button>
            </div>
          </section>
        )}

        {/* PASO 2: VER HORARIOS DISPONIBLES */}
        {step === 2 && (
          <section className={styles.stepCard} aria-labelledby="step-2-heading">
            <h1 id="step-2-heading" tabIndex={-1} ref={headingRef} className={styles.stepTitle}>
              Paso 2: Horarios disponibles
            </h1>
            <p className={styles.stepSubtitle}>
              Para el <strong>{readableDate(date)}</strong> con {assignedDoctor.name} · {currentService.name}.
            </p>

            {serverError && <div className={styles.errorAlert}>{serverError}</div>}

            {(slotsHook.daily?.walkInDisponible || date === todayStr) && (
              <div className={styles.walkInBanner}>
                <PublicIcon name="clock" />
                <div>
                  <strong>Atención el mismo día (regla de 15 minutos)</strong>
                  <span>
                    {slotsHook.daily?.mensajeWalkIn ||
                      "Las reservas web requieren mínimo 15 minutos de anticipación. Si pasas ese tiempo o necesitas atención inmediata hoy, se aceptan consultas presenciales en el consultorio (con posible espera)."}
                  </span>
                </div>
              </div>
            )}

            {/* Estados: Carga, Error o Sin horarios */}
            {slotsLoading && (
              <div className={styles.loadingBox}>
                <span className={styles.spinner} />
                <p>Consultando horarios disponibles en tiempo real con el consultorio...</p>
              </div>
            )}

            {!slotsLoading && slotsError && (
              <div className={styles.errorAlert}>
                <p>{slotsError}</p>
                <button
                  type="button"
                  onClick={() => slotsHook.refresh()}
                  className={styles.retryBtn}
                >
                  Reintentar consulta
                </button>
              </div>
            )}

            {!slotsLoading && !slotsError && availableSlots.length === 0 && (
              <div className={styles.emptyBox}>
                <PublicIcon name="calendar" />
                <h3>Este día ya no es reservable en línea</h3>
                <p>
                  {slotsHook.daily?.mensajeWalkIn ||
                    "Todos los turnos de esta fecha han sido ocupados o superaron el límite de 15 minutos previos al horario."}
                </p>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => {
                    monthHook.refresh();
                    goToStep(1);
                  }}
                >
                  Elegir otro día disponible en el calendario
                </button>
              </div>
            )}

            {!slotsLoading && !slotsError && availableSlots.length > 0 && (
              <div className={styles.slotsContainer}>
                {morningSlots.length > 0 && (
                  <div className={styles.slotGroup}>
                    <h3 className={styles.slotGroupTitle}>Mañana (09:00 a 12:00)</h3>
                    <div className={styles.slotGrid}>
                      {morningSlots.map((slot) => {
                        const isChosen =
                          selectedSlot &&
                          slotKey(selectedSlot) === slotKey(slot) &&
                          selectedSlot.date === slot.date;
                        return (
                          <button
                            key={slotKey(slot)}
                            type="button"
                            className={`${styles.slotBtn} ${isChosen ? styles.slotBtnChosen : ""}`}
                            onClick={() => setSelectedSlot(slot)}
                            aria-pressed={Boolean(isChosen)}
                          >
                            <span className={styles.slotTime}>{slot.time}</span>
                            {isChosen && <span className={styles.checkIcon}>✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {afternoonSlots.length > 0 && (
                  <div className={styles.slotGroup}>
                    <h3 className={styles.slotGroupTitle}>Tarde (12:00 a 17:00)</h3>
                    <div className={styles.slotGrid}>
                      {afternoonSlots.map((slot) => {
                        const isChosen =
                          selectedSlot &&
                          slotKey(selectedSlot) === slotKey(slot) &&
                          selectedSlot.date === slot.date;
                        return (
                          <button
                            key={slotKey(slot)}
                            type="button"
                            className={`${styles.slotBtn} ${isChosen ? styles.slotBtnChosen : ""}`}
                            onClick={() => setSelectedSlot(slot)}
                            aria-pressed={Boolean(isChosen)}
                          >
                            <span className={styles.slotTime}>{slot.time}</span>
                            {isChosen && <span className={styles.checkIcon}>✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {selectedSlot && (
                  <div className={styles.chosenSlotBanner}>
                    Turno seleccionado: <strong>{selectedSlot.time}</strong> del {readableDate(selectedSlot.date)}
                  </div>
                )}

                <div className={styles.actionRow}>
                  <button
                    type="button"
                    className="button"
                    disabled={!selectedSlot}
                    onClick={() => goToStep(3)}
                  >
                    Completar mis datos <PublicIcon name="arrow" />
                  </button>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => goToStep(1)}
                  >
                    Cambiar fecha
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* PASO 3: COMPLETAR DATOS DEL PACIENTE */}
        {step === 3 && selectedSlot && (
          <section className={styles.stepCard} aria-labelledby="step-3-heading">
            <h1 id="step-3-heading" tabIndex={-1} ref={headingRef} className={styles.stepTitle}>
              Paso 3: Completa tus datos de paciente
            </h1>
            <p className={styles.stepSubtitle}>
              Cita para el <strong>{readableDate(selectedSlot.date)} a las {selectedSlot.time}</strong> · {currentService.name}.
            </p>

            {serverError && <div className={styles.errorAlert}>{serverError}</div>}

            <form onSubmit={handleSubmitBooking} className={styles.patientForm} noValidate>
              <div className={styles.formField}>
                <label htmlFor="patient-name" className={styles.formLabel}>
                  Nombre completo <span className={styles.req}>*</span>
                </label>
                <input
                  id="patient-name"
                  type="text"
                  required
                  placeholder="Ej. Carmen Rosa Quispe Flores"
                  value={patient.name}
                  onChange={(e) => setPatient({ ...patient, name: e.target.value })}
                  className={`${styles.textInput} ${formErrors.name ? styles.inputError : ""}`}
                />
                {formErrors.name && <span className={styles.fieldErrorMsg}>{formErrors.name}</span>}
              </div>

              <div className={styles.formRow}>
                <div className={styles.formField}>
                  <label htmlFor="patient-phone" className={styles.formLabel}>
                    Teléfono o DNI <span className={styles.req}>*</span>
                  </label>
                  <input
                    id="patient-phone"
                    type="text"
                    required
                    placeholder="Ej. 966000000 o 45678901"
                    value={patient.phone}
                    onChange={(e) => setPatient({ ...patient, phone: e.target.value })}
                    className={`${styles.textInput} ${formErrors.phone ? styles.inputError : ""}`}
                  />
                  {formErrors.phone && <span className={styles.fieldErrorMsg}>{formErrors.phone}</span>}
                </div>

                <div className={styles.formField}>
                  <label htmlFor="patient-dni" className={styles.formLabel}>
                    DNI / Documento (opcional)
                  </label>
                  <input
                    id="patient-dni"
                    type="text"
                    placeholder="Ej. 45678901"
                    value={patient.dni}
                    onChange={(e) => setPatient({ ...patient, dni: e.target.value })}
                    className={styles.textInput}
                  />
                </div>
              </div>

              <div className={styles.formField}>
                <label htmlFor="patient-email" className={styles.formLabel}>
                  Correo electrónico (opcional)
                </label>
                <input
                  id="patient-email"
                  type="email"
                  placeholder="ejemplo@correo.com"
                  value={patient.email}
                  onChange={(e) => setPatient({ ...patient, email: e.target.value })}
                  className={`${styles.textInput} ${formErrors.email ? styles.inputError : ""}`}
                />
                {formErrors.email && <span className={styles.fieldErrorMsg}>{formErrors.email}</span>}
              </div>

              <div className={styles.formField}>
                <label htmlFor="patient-reason" className={styles.formLabel}>
                  Motivo de consulta (opcional)
                </label>
                <textarea
                  id="patient-reason"
                  rows={3}
                  placeholder="Cuéntanos brevemente si presentas algún dolor, molestia o qué deseas consultar..."
                  value={patient.reason}
                  onChange={(e) => setPatient({ ...patient, reason: e.target.value })}
                  className={styles.textInput}
                />
              </div>

              <div className={styles.checkboxField}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={patient.whatsappOptIn}
                    onChange={(e) => setPatient({ ...patient, whatsappOptIn: e.target.checked })}
                    className={styles.checkboxInput}
                  />
                  <span>Deseo recibir confirmación y recordatorio de mi cita por WhatsApp o mensaje</span>
                </label>
              </div>

              <div className={styles.actionRow}>
                <button
                  type="submit"
                  disabled={submitting}
                  className="button"
                >
                  {submitting ? "Procesando cita..." : "Confirmar reserva"} <PublicIcon name="arrow" />
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => goToStep(2)}
                  disabled={submitting}
                >
                  Cambiar horario
                </button>
              </div>
            </form>
          </section>
        )}

        {/* PASO 4: PANTALLA DE CONFIRMACIÓN */}
        {step === 4 && (appointment || hold?.appointment) && (
          <section className={styles.stepCard} aria-labelledby="step-4-heading">
            {(() => {
              const appt = appointment ?? hold!.appointment;
              const isConfirmed = appt.status === "CONFIRMED";

              return (
                <>
                  <div className={styles.successHeader}>
                    <div className={styles.successIcon}>✓</div>
                    <h1 id="step-4-heading" tabIndex={-1} ref={headingRef} className={styles.stepTitle}>
                      {isConfirmed ? "¡Tu cita ha sido confirmada!" : "¡Tu turno ha sido reservado!"}
                    </h1>
                    <p className={styles.stepSubtitle}>
                      {isConfirmed
                        ? "Te esperamos en el consultorio. Guarda los detalles de tu turno."
                        : "Tu horario se encuentra retenido. Confirma tu cita para asegurar tu atención."}
                    </p>
                  </div>

                  {remaining !== null && remaining > 0 && !isConfirmed && (
                    <div className={styles.holdTimerNotice}>
                      Tiempo restante para confirmar la retención: <strong>{remaining} segundos</strong>
                    </div>
                  )}

                  {serverError && <div className={styles.errorAlert}>{serverError}</div>}

                  <div className={styles.summaryCard}>
                    <h2 className={styles.summaryTitle}>Resumen de la Cita Odontológica</h2>
                    <dl className={styles.summaryList}>
                      <div className={styles.summaryItem}>
                        <dt>Paciente</dt>
                        <dd>{appt.patientName || patient.name}</dd>
                      </div>
                      <div className={styles.summaryItem}>
                        <dt>Tratamiento / Servicio</dt>
                        <dd>{appt.serviceName} ({currentService.duration} min)</dd>
                      </div>
                      <div className={styles.summaryItem}>
                        <dt>Odontólogo asignado</dt>
                        <dd>{appt.professionalName} ({assignedDoctor.title})</dd>
                      </div>
                      <div className={styles.summaryItem}>
                        <dt>Fecha y Hora</dt>
                        <dd>{readableDate(appt.date)} a las {appt.time}</dd>
                      </div>
                      <div className={styles.summaryItem}>
                        <dt>Ubicación</dt>
                        <dd>{location}</dd>
                      </div>
                      <div className={styles.summaryItem}>
                        <dt>Precio referencial</dt>
                        <dd>{price(appt.priceCents)}</dd>
                      </div>
                      {patient.reason && (
                        <div className={styles.summaryItemFull}>
                          <dt>Motivo de consulta</dt>
                          <dd>{patient.reason}</dd>
                        </div>
                      )}
                      <div className={styles.summaryItemFull}>
                        <dt>Estado de la cita</dt>
                        <dd className={styles.statusBadge}>{appt.status}</dd>
                      </div>
                    </dl>
                  </div>

                  <div className={styles.confirmationActions}>
                    {!isConfirmed && (
                      <button
                        type="button"
                        onClick={handleConfirmBooking}
                        disabled={submitting}
                        className="button"
                      >
                        {submitting ? "Confirmando..." : "Confirmar cita ahora"}
                      </button>
                    )}

                    <a
                      href={calendarHref(appt)}
                      download={`cita-${appt.date}.ics`}
                      className="button-secondary"
                    >
                      Añadir a mi calendario (.ics)
                    </a>

                    {hold?.token && (
                      <Link
                        href={`/mi-cita/${hold.token}`}
                        className={styles.manageAppointmentLink}
                      >
                        Gestionar o reprogramar mi cita
                      </Link>
                    )}

                    <Link href="/" className={styles.returnHomeLink}>
                      Volver a la página principal
                    </Link>
                  </div>
                </>
              );
            })()}
          </section>
        )}
      </div>
    </main>
  );
}
