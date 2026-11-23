import Image from "next/image";
import Link from "next/link";
import { clinic, professionals, services } from "@/lib/catalog";
import styles from "./landing.module.css";

export const metadata = {
  title: "Reserva una cita dental en Lima",
  description: "Conoce los servicios y elige un horario para tu próxima cita dental.",
};

const money = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN", maximumFractionDigits: 2 });

export default function HomePage() {
  return (
    <>
      <a href="#contenido" className={styles.skip}>Saltar al contenido</a>
      <header className={styles.top}>
        <div className={`shell ${styles.header}`}>
          <Link href="/" className={styles.brand}>
            <span className={styles.mark} aria-hidden="true">+</span>
            Consultorio dental
          </Link>
          <nav className={styles.navigation} aria-label="Información del consultorio">
            <a href="#servicios">Servicios</a>
            <a href="#equipo">Equipo</a>
            <a href="#visita">Horario</a>
          </nav>
          <Link className={styles.staff} href="/ingresar">Acceso del equipo</Link>
        </div>
      </header>

      <main id="contenido">
        <section className={`shell ${styles.hero}`}>
          <div className={styles.heroCopy}>
            <p className={styles.location}>{clinic.location}</p>
            <h1>Reserva tu cita dental</h1>
            <p className={styles.lead}>Elige un servicio y encuentra un horario que te acomode.</p>
            <div className={styles.actions}>
              <Link href="/reservar" className="button">Ver horarios</Link>
              <Link href="/mi-cita" className={styles.textLink}>Gestionar mi cita</Link>
            </div>
            <p className={styles.demo}>Versión de demostración con datos de ejemplo.</p>
          </div>
          <div className={styles.heroArt}>
            <Image src="/ilustraciones/landing-hero.svg" width={640} height={480} alt="" preload />
          </div>
        </section>

        <section id="servicios" className={styles.catalog}>
          <div className="shell">
            <div className={styles.sectionHeading}>
              <h2>Servicios y precios referenciales</h2>
              <p>Conoce la duración estimada antes de reservar.</p>
            </div>
            <div className={styles.services}>
              {services.map((service) => (
                <article key={service.id} className={styles.service}>
                  <h3>{service.name}</h3>
                  <p>{service.description}</p>
                  <div className={styles.serviceMeta}>
                    <span>{service.duration} min</span>
                    <strong>{money.format(service.priceCents / 100)}</strong>
                  </div>
                </article>
              ))}
            </div>
            <Link href="/reservar" className="button-secondary">Elegir servicio y horario</Link>
          </div>
        </section>

        <section id="equipo" className={`shell ${styles.split}`}>
          <div>
            <div className={styles.sectionHeading}>
              <h2>Equipo de atención</h2>
              <p>Puedes elegir un profesional o ver el primer turno disponible.</p>
            </div>
            <ul className={styles.team}>
              {professionals.map((professional) => (
                <li key={professional.id}>
                  <strong>{professional.name}</strong>
                  <span>{professional.title} · perfil de ejemplo</span>
                </li>
              ))}
            </ul>
          </div>
          <Image className={styles.sectionArt} src="/ilustraciones/landing-equipo.svg" width={480} height={320} alt="" />
        </section>

        <section id="visita" className={styles.visit}>
          <div className={`shell ${styles.split}`}>
            <div>
              <div className={styles.sectionHeading}>
                <h2>Horario y ubicación</h2>
              </div>
              <dl className={styles.hours}>
                <div><dt>Horario de demostración</dt><dd>{clinic.hours}</dd></div>
                <div><dt>Ubicación</dt><dd>{clinic.location}</dd></div>
              </dl>
              <Link className="button" href="/reservar">Reservar una cita</Link>
            </div>
            <Image className={styles.sectionArt} src="/ilustraciones/landing-visita.svg" width={480} height={320} alt="" />
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={`shell ${styles.footerInner}`}>
          <span>Consultorio dental · Lima, Perú</span>
          <Link href="/ingresar">Acceso del equipo</Link>
        </div>
      </footer>
    </>
  );
}
