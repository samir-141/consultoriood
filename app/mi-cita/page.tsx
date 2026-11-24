import type { Metadata } from "next";
import Link from "next/link";
import { ClinicBrand } from "@/app/components/clinic-brand";
import styles from "@/app/reservar/booking.module.css";
import { Gomita } from "@/app/reservar/gomita";

export const metadata: Metadata = { title: "Mi cita" };

export default function MyAppointmentPage() {
  return (
    <main className={styles.page}>
      <ClinicBrand />
      <header className={`${styles.intro} ${styles.appointmentIntro}`}>
        <h1>Mi cita</h1>
        <Gomita pose="saludo" compact />
      </header>
      <section className={`${styles.card} ${styles.single}`} aria-labelledby="find-appointment">
        <div className={styles.stage}>
          <h2 id="find-appointment">Abre tu enlace de confirmación</h2>
          <p>
            Abre el enlace personal que recibiste al confirmar. Puedes cambiar o cancelar antes de la hora de inicio.
            El enlace vence 24 horas después de que termina la cita.
          </p>
          <div className={styles.actions}>
            <Link className={styles.primary} href="/reservar">Reservar una cita</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
