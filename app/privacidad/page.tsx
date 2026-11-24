import type { Metadata } from "next";
import { ClinicBrand } from "@/app/components/clinic-brand";
import styles from "../landing.module.css";

export const metadata: Metadata = {
  title: "Privacidad de la demostración",
  description: "Cómo se usan los datos de prueba al practicar una reserva dental.",
};

export default function PrivacyPage() {
  return (
    <main className={`shell ${styles.detail}`}>
      <ClinicBrand />
      <article className="panel">
        <h1>Privacidad de la demostración</h1>
        <p>Usa nombres, teléfonos y correos ficticios. Evita escribir datos de pacientes o subir documentos reales.</p>
        <h2>Datos que pide la reserva</h2>
        <p>La demo usa tus datos de prueba y el turno elegido para guardar y mostrar la cita en esta instalación. El correo es opcional. Los envíos por WhatsApp se simulan.</p>
        <h2>Enlace para gestionar una cita</h2>
        <p>El enlace de confirmación permite consultar la cita y realizar cambios según su estado. Guárdalo en un lugar privado.</p>
      </article>
    </main>
  );
}
