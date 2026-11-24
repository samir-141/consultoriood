"use client";

import { useState } from "react";
import { atLima, validDate, validTime } from "@/lib/clinic-time";
import styles from "../landing.module.css";

type Result =
  | { state: "idle" | "loading" | "empty" | "error" }
  | { state: "ready"; date: string; time: string };

const dateTime = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima", dateStyle: "full", timeStyle: "short",
});

export function NextAppointment() {
  const [result, setResult] = useState<Result>({ state: "idle" });

  async function lookup() {
    setResult({ state: "loading" });
    try {
      const response = await fetch("/api/disponibilidad/proxima?serviceId=evaluacion", { cache: "no-store" });
      if (!response.ok) throw new Error("Disponibilidad no disponible");
      const { slot } = await response.json();
      if (slot === null) {
        setResult({ state: "empty" });
      } else if (typeof slot?.date === "string" && typeof slot.time === "string" && validDate(slot.date) && validTime(slot.time)) {
        setResult({ state: "ready", date: slot.date, time: slot.time });
      } else {
        setResult({ state: "error" });
      }
    } catch {
      setResult({ state: "error" });
    }
  }

  return (
    <div className={styles.availabilityResult}>
      <p role="status" className={styles.resultText}>
        {result.state === "loading" && "Buscando el primer turno disponible…"}
        {result.state === "ready" && <>Próximo turno: <strong>{dateTime.format(atLima(result.date, result.time))}</strong> (hora de Lima).</>}
        {result.state === "empty" && "No encontramos turnos en los próximos siete días. Puedes probar otra fecha al reservar."}
        {result.state === "error" && "No pudimos consultar los horarios. Inténtalo otra vez."}
      </p>
      <button type="button" onClick={lookup} disabled={result.state === "loading"} className="button-secondary">
        {result.state === "idle" ? "Consultar próximo turno" : "Actualizar disponibilidad"}
      </button>
    </div>
  );
}
