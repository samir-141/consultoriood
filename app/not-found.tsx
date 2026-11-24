import Link from "next/link";
import { ClinicBrand } from "@/app/components/clinic-brand";
import styles from "./landing.module.css";

export default function NotFoundPage() {
  return (
    <main className={`shell ${styles.detail}`}>
      <ClinicBrand />
      <article className="panel">
        <h1>Página no encontrada</h1>
        <p>Si buscabas una cita, abre el enlace que recibiste al confirmar.</p>
        <div className={styles.detailActions}><Link href="/" className="button">Ir al inicio</Link></div>
      </article>
    </main>
  );
}
