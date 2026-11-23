import type { Metadata } from "next";
import Link from "next/link";
import styles from "@/app/reservar/booking.module.css";

export const metadata: Metadata = { title: "Mi cita" };

export default function MyAppointmentPage() {
  return (
    <main className={styles.page}>
      <Link className={styles.exitLink} href="/">Volver al inicio</Link>
      <header className={styles.intro}>
        <h1>Mi cita</h1>
      </header>
      <section className={`${styles.card} ${styles.single}`} aria-labelledby="find-appointment">
        <div className={styles.stage}>
          <h2 id="find-appointment">Abre tu enlace de confirmación</h2>
          <p>El enlace aparece al confirmar tu reserva. Úsalo para consultar, cambiar o cancelar tu cita.</p>
          <div className={styles.actions}>
            <Link className={styles.primary} href="/reservar">Reservar una cita</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
