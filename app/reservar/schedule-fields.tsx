"use client";

import { useEffect, useId, useRef, useState, type RefObject } from "react";
import {
  bookingMessage,
  isBookingDay,
  lastBookingDay,
  nextDayWithSlots,
  readableDate,
  slotKey,
  todayInLima,
  type Slot,
  type useSlots,
} from "./reserva";
import styles from "./booking.module.css";

type ScheduleFieldsProps = {
  serviceId: string;
  professionalId: string;
  date: string;
  timeValue: string;
  availability: ReturnType<typeof useSlots>;
  onDateChange: (date: string) => void;
  onSlotChange: (slot: Slot | null) => void;
  dateInputRef?: RefObject<HTMLInputElement | null>;
  dateLabel?: string;
  disabled?: boolean;
};

type AlternateDay = { key: string; state: "loading" | "found" | "empty" | "error"; message: string };

export function ScheduleFields({
  serviceId,
  professionalId,
  date,
  timeValue,
  availability,
  onDateChange,
  onSlotChange,
  dateInputRef,
  dateLabel = "Fecha",
  disabled = false,
}: ScheduleFieldsProps) {
  const id = useId();
  const localDateRef = useRef<HTMLInputElement>(null);
  const dateRef = dateInputRef ?? localDateRef;
  const searchRequest = useRef<AbortController | null>(null);
  const [alternateDay, setAlternateDay] = useState<AlternateDay | null>(null);
  const today = todayInLima();
  const lastDate = lastBookingDay(today);
  const valid = isBookingDay(date, today);
  const dateKey = (day: string) => `${serviceId}|${professionalId}|${day}`;
  const search = alternateDay?.key === dateKey(date) ? alternateDay : null;
  const groups = [
    { label: "Mañana", slots: availability.slots.filter(({ time }) => time < "12:00") },
    { label: "Tarde", slots: availability.slots.filter(({ time }) => time >= "12:00") },
  ];
  const empty = valid && !availability.loading && !availability.error && !availability.slots.length;
  const showSearchResult = search?.state === "empty" || (search?.state === "found" && availability.slots.length > 0);

  useEffect(() => () => searchRequest.current?.abort(), [date, serviceId, professionalId]);

  async function findAlternateDay() {
    const controller = new AbortController();
    searchRequest.current?.abort();
    searchRequest.current = controller;
    setAlternateDay({ key: dateKey(date), state: "loading", message: "Buscando otros horarios…" });
    try {
      const nextDate = await nextDayWithSlots(date, serviceId, professionalId, controller.signal);
      if (controller.signal.aborted) return;
      if (!nextDate) {
        setAlternateDay({
          key: dateKey(date),
          state: "empty",
          message: "No encontramos horarios en los próximos siete días. Elige otra fecha o cambia de profesional.",
        });
        return;
      }
      onDateChange(nextDate);
      setAlternateDay({
        key: dateKey(nextDate),
        state: "found",
        message: `Encontramos horarios para el ${readableDate(nextDate)}.`,
      });
      dateRef.current?.focus();
    } catch (error) {
      if (!controller.signal.aborted) {
        setAlternateDay({ key: dateKey(date), state: "error", message: bookingMessage(error) });
      }
    }
  }

  return (
    <div className={styles.availability}>
      <div className={styles.row}>
        <div className={styles.field}>
          <label htmlFor={`${id}-date`}>{dateLabel}</label>
          <input
            ref={dateRef}
            id={`${id}-date`}
            name="date"
            type="date"
            min={today}
            max={lastDate}
            required
            value={date}
            disabled={disabled}
            aria-invalid={date && !valid ? true : undefined}
            aria-describedby={`${id}-range`}
            onChange={(event) => {
              searchRequest.current?.abort();
              setAlternateDay(null);
              onDateChange(event.target.value);
            }}
          />
          <p id={`${id}-range`} className={styles.muted}>Hasta el {readableDate(lastDate)}.</p>
        </div>
        <div className={styles.field}>
          <label htmlFor={`${id}-time`}>Hora de Lima</label>
          <select
            id={`${id}-time`}
            name="time"
            required
            value={timeValue}
            disabled={disabled || availability.loading || !availability.slots.length}
            onChange={(event) => {
              const value = event.target.value;
              onSlotChange(availability.slots.find((slot) => slotKey(slot) === value) ?? null);
            }}
          >
            <option value="" disabled>
              {availability.loading ? "Buscando horas…" : "Selecciona una hora"}
            </option>
            {groups.filter((group) => group.slots.length > 0).map(({ label, slots }) => (
              <optgroup key={label} label={label}>
                {slots.map((slot) => (
                  <option key={slotKey(slot)} value={slotKey(slot)}>
                    {slot.time} · {slot.professionalName}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      </div>
      <p role="status" className={styles.availabilityStatus}>
        {search && (search.state === "loading" || showSearchResult)
          ? search.message
          : availability.loading
            ? "Buscando horarios…"
            : empty
              ? "No hay horarios para esa fecha. Elige otro día o busca una alternativa."
              : ""}
      </p>
      {date && !valid && (
        <p className={styles.error} role="alert">Elige una fecha desde hoy hasta el {readableDate(lastDate)}.</p>
      )}
      {(availability.error || search?.state === "error") && (
        <p className={styles.error} role="alert">{availability.error || search?.message}</p>
      )}
      {availability.error && (
        <button type="button" className={styles.simpleButton} disabled={disabled} onClick={availability.refresh}>
          Buscar otra vez
        </button>
      )}
      {empty && date < lastDate && (
        <button
          type="button"
          className={styles.simpleButton}
          disabled={disabled || search?.state === "loading"}
          onClick={findAlternateDay}
        >
          Buscar el siguiente día con horarios
        </button>
      )}
    </div>
  );
}
