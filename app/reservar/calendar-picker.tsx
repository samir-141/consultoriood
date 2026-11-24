"use client";

import { useState } from "react";
import { addDays, atLima, limaDate, validDate } from "@/lib/clinic-time";
import type { DayAvailabilityInfo } from "./reserva";
import styles from "./calendar.module.css";

type CalendarPickerProps = {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onMonthChange?: (month: string) => void;
  dayStates?: Record<string, DayAvailabilityInfo>;
  loadingMonth?: boolean;
  minDate?: string;
  maxDate?: string;
  workingDays?: number[]; // [1,2,3,4,5,6] (0 = Sunday)
};

export function CalendarPicker({
  selectedDate,
  onSelectDate,
  onMonthChange,
  dayStates,
  loadingMonth = false,
  minDate = limaDate(),
  maxDate = addDays(limaDate(), 90),
  workingDays = [1, 2, 3, 4, 5, 6],
}: CalendarPickerProps) {
  const initialDate = validDate(selectedDate) ? atLima(selectedDate) : atLima(minDate);
  const [currentYear, setCurrentYear] = useState(initialDate.getUTCFullYear());
  const [currentMonth, setCurrentMonth] = useState(initialDate.getUTCMonth()); // 0-11

  function emitMonth(year: number, monthIndex: number) {
    if (onMonthChange) {
      onMonthChange(`${year}-${String(monthIndex + 1).padStart(2, "0")}`);
    }
  }

  function prevMonth() {
    const nextY = currentMonth === 0 ? currentYear - 1 : currentYear;
    const nextM = currentMonth === 0 ? 11 : currentMonth - 1;
    setCurrentYear(nextY);
    setCurrentMonth(nextM);
    emitMonth(nextY, nextM);
  }

  function nextMonth() {
    const nextY = currentMonth === 11 ? currentYear + 1 : currentYear;
    const nextM = currentMonth === 11 ? 0 : currentMonth + 1;
    setCurrentYear(nextY);
    setCurrentMonth(nextM);
    emitMonth(nextY, nextM);
  }

  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Setiembre", "Octubre", "Noviembre", "Diciembre",
  ];
  const weekDays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  const firstDayOfMonth = new Date(Date.UTC(currentYear, currentMonth, 1));
  const daysInMonth = new Date(Date.UTC(currentYear, currentMonth + 1, 0)).getUTCDate();

  let startOffset = firstDayOfMonth.getUTCDay() - 1;
  if (startOffset < 0) startOffset = 6;

  const cells: {
    dateStr: string;
    dayNum: number;
    disabled: boolean;
    isCurrentMonth: boolean;
    reason: string;
    availableCount?: number;
  }[] = [];

  for (let i = 0; i < startOffset; i++) {
    cells.push({ dateStr: "", dayNum: 0, disabled: true, isCurrentMonth: false, reason: "" });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const y = currentYear;
    const m = String(currentMonth + 1).padStart(2, "0");
    const day = String(d).padStart(2, "0");
    const dateStr = `${y}-${m}-${day}`;
    const dayOfWeek = new Date(Date.UTC(y, currentMonth, d)).getUTCDay();

    const isPast = dateStr < minDate;
    const isFutureLimit = dateStr > maxDate;
    const isNonWorking = !workingDays.includes(dayOfWeek);
    const serverState = dayStates?.[dateStr];
    const noSlotsLeft = Boolean(serverState && !serverState.reservable);
    const disabled = isPast || isFutureLimit || isNonWorking || noSlotsLeft;

    let reason = "";
    if (isPast) reason = "fecha pasada";
    else if (isNonWorking) reason = "domingo no laborable";
    else if (serverState?.status === "FULL") reason = "sin horarios disponibles";
    else if (serverState?.status === "CUTOFF_WALKIN" || serverState?.status === "AFTER_HOURS") {
      reason = "sin reservas web (consultas presenciales en consultorio)";
    } else if (isFutureLimit) reason = "fuera del horizonte de reservas";

    cells.push({
      dateStr,
      dayNum: d,
      disabled,
      isCurrentMonth: true,
      reason,
      availableCount: serverState?.availableCount,
    });
  }

  return (
    <div className={styles.calendarContainer}>
      <div className={styles.calendarHeader}>
        <button
          type="button"
          onClick={prevMonth}
          className={styles.navButton}
          aria-label="Mes anterior"
        >
          &larr;
        </button>
        <div className={styles.monthTitle}>
          <strong>{monthNames[currentMonth]} {currentYear}</strong>
          {loadingMonth && <span className={styles.loadingTag}>Actualizando cupos…</span>}
        </div>
        <button
          type="button"
          onClick={nextMonth}
          className={styles.navButton}
          aria-label="Siguiente mes"
        >
          &rarr;
        </button>
      </div>

      <div className={styles.weekGrid}>
        {weekDays.map((wd) => (
          <div key={wd} className={styles.weekDayHeader}>
            {wd}
          </div>
        ))}
      </div>

      <div className={styles.daysGrid}>
        {cells.map((cell, idx) => {
          if (!cell.isCurrentMonth) {
            return <div key={`empty-${idx}`} className={styles.emptyCell} />;
          }

          const isSelected = !cell.disabled && cell.dateStr === selectedDate;
          const isToday = cell.dateStr === minDate;

          return (
            <button
              key={cell.dateStr}
              type="button"
              disabled={cell.disabled}
              title={cell.disabled && cell.reason ? cell.reason : undefined}
              className={`${styles.dayButton} ${isSelected ? styles.selectedDay : ""} ${
                isToday ? styles.todayDay : ""
              }`}
              onClick={() => {
                if (!cell.disabled) onSelectDate(cell.dateStr);
              }}
              aria-label={`Día ${cell.dayNum} de ${monthNames[currentMonth]} de ${currentYear}${
                cell.disabled ? ` (${cell.reason || "no disponible"})` : ""
              }`}
              aria-pressed={isSelected}
            >
              <span className={styles.dayNumber}>{cell.dayNum}</span>
              {isSelected && <span className={styles.selectedDot} />}
            </button>
          );
        })}
      </div>

      <div className={styles.calendarLegend}>
        <div className={styles.legendItem}>
          <span className={styles.legendDotAvailable} /> Disponible
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendDotDisabled} /> Sin cupos / No laborable
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendDotSelected} /> Seleccionado
        </div>
      </div>

      {/* Input nativo complementario accesible */}
      <div className={styles.nativeFallback}>
        <label htmlFor="calendar-date-input" className={styles.fallbackLabel}>
          O ingresa la fecha manualmente:
        </label>
        <input
          id="calendar-date-input"
          type="date"
          min={minDate}
          max={maxDate}
          value={selectedDate}
          onChange={(e) => {
            const val = e.target.value;
            onSelectDate(val);
            if (validDate(val)) {
              const dt = atLima(val);
              const yr = dt.getUTCFullYear();
              const mo = dt.getUTCMonth();
              setCurrentYear(yr);
              setCurrentMonth(mo);
              emitMonth(yr, mo);
            }
          }}
          className={styles.nativeInput}
        />
      </div>
    </div>
  );
}
