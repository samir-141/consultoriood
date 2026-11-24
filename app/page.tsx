import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ClinicBrand } from "@/app/components/clinic-brand";
import { NextAppointment } from "@/app/components/next-appointment";
import { PublicIcon } from "@/app/components/public-icon";
import { clinic, professionals } from "@/lib/catalog";
import { heroPhoto, publicDescription, publicServices, servicePrice } from "./public-content";
import { publicSiteOrigin } from "./public-url";
import styles from "./landing.module.css";

const origin = publicSiteOrigin();

export const metadata: Metadata = {
  title: "Clínica dental en Lima",
  description: publicDescription,
  ...(origin && { alternates: { canonical: origin } }),
  openGraph: {
    title: "Gómez Delgado Clínica Dental",
    description: publicDescription,
    type: "website",
    locale: "es_PE",
    siteName: clinic.name,
    ...(origin && {
      url: origin,
      images: [{ url: new URL(heroPhoto, origin), alt: "Imagen ilustrativa de una consulta dental" }],
    }),
  },
};

const evaluation = publicServices.find(({ id }) => id === "evaluacion");
const publicHours = clinic.hours.replaceAll(". m.", ".\u00a0m.");

const questions = [
  {
    question: "¿Cuánto cuesta y cuánto dura una evaluación?",
    answer: evaluation
      ? `La evaluación del catálogo de demostración dura ${evaluation.duration} minutos y tiene un precio referencial de ${servicePrice(evaluation.priceCents)}. El profesional puede explicarte las alternativas y los costos antes de continuar.`
      : "Revisa el catálogo para consultar las duraciones y los precios referenciales.",
  },
  {
    question: "¿Cómo reservo una cita?",
    answer: "Elige un servicio, selecciona un horario disponible y confirma la reserva después de revisar tus datos.",
  },
  {
    question: "¿Cómo cambio o cancelo mi cita?",
    answer: "Abre el enlace que aparece al confirmar la reserva. Desde allí puedes revisar tu cita y consultar las opciones para cambiarla o cancelarla.",
  },
  {
    question: "¿Qué llevo a la primera visita?",
    answer: "Puedes llevar tus indicaciones previas y anotar las preguntas que quieras hacer durante la consulta.",
  },
  {
    question: "¿Puedo consultar por atención infantil, urgencias o medios de pago?",
    answer: "Estos datos requieren confirmación del consultorio. El catálogo de demostración muestra las prestaciones disponibles para practicar el flujo de reserva.",
  },
];

export default function HomePage() {
  return (
    <div className={styles.site}>
      <a href="#contenido" className={styles.skip}>Saltar al contenido</a>
      <header className={styles.top}>
        <div className={`shell ${styles.header}`}>
          <ClinicBrand />
          <nav className={styles.navigation} aria-label="Navegación principal">
            <a href="#servicios">Servicios</a>
            <a href="#primera-visita">Primera visita</a>
            <a href="#ubicacion">Ubicación</a>
          </nav>
          <Link className={styles.headerAction} href="/reservar">
            Reservar cita <PublicIcon name="arrow" />
          </Link>
        </div>
      </header>

      <main id="contenido" tabIndex={-1}>
        <section className={`shell ${styles.hero}`} aria-labelledby="home-title">
          <div className={styles.heroCopy}>
            <p className={styles.location}><PublicIcon name="location" />{clinic.location}</p>
            <h1 id="home-title">Tu salud dental, <em>paso a paso.</em></h1>
            <p className={styles.lead}>Conoce tus opciones de atención, elige un horario y llega a tu consulta con tus preguntas claras.</p>
            <div className={styles.actions}>
              <Link href="/reservar" className="button">Reservar cita <PublicIcon name="arrow" /></Link>
              <a href="#servicios" className={styles.textLink}>Ver servicios</a>
            </div>
            {clinic.demo && <p className={styles.demo}>Demostración. Usa datos ficticios al reservar.</p>}
          </div>
          <figure className={styles.heroArt}>
            <Image
              src={heroPhoto}
              width={1440}
              height={960}
              sizes="(max-width: 48rem) calc(100vw - 2rem), (max-width: 74rem) 52vw, 600px"
              alt="Una paciente sonríe mientras conversa con una profesional en un consultorio dental."
              loading="eager"
              fetchPriority="high"
            />
            <figcaption>Imagen ilustrativa</figcaption>
          </figure>
        </section>

        <div className={`shell ${styles.practical}`}>
          <div>
            <span className={styles.icon}><PublicIcon name="clock" /></span>
            <div><p>Horario de atención</p><span>{publicHours}</span></div>
          </div>
          <div>
            <span className={styles.icon}><PublicIcon name="location" /></span>
            <div><p>Ubicación</p><span>{clinic.location}</span></div>
          </div>
          <div>
            <span className={styles.icon}><PublicIcon name="calendar" /></span>
            <div><p>¿Ya tienes un turno?</p><Link className={styles.textLink} href="/mi-cita">Gestionar mi cita</Link></div>
          </div>
        </div>

        <section id="servicios" className={`shell ${styles.section}`} aria-labelledby="services-title">
          <div className={styles.sectionHeading}>
            <h2 id="services-title">¿Cómo podemos ayudarte?</h2>
            <p>Compara las opciones según lo que necesites. Los precios son referenciales.</p>
          </div>
          <div className={styles.services}>
            {publicServices.map((service) => (
              <article key={service.id} className={styles.service}>
                <span className={styles.icon}><PublicIcon name={service.id} /></span>
                <h3>{service.name}</h3>
                <p>{service.intent}</p>
                <div className={styles.serviceMeta}>
                  <span>{service.duration} min</span>
                  <strong>{servicePrice(service.priceCents)}</strong>
                </div>
                <Link href={`/servicios/${service.id}`} className={styles.cardLink}>
                  Ver {service.name.toLocaleLowerCase("es-PE")} <PublicIcon name="arrow" />
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className={`shell ${styles.availability}`} aria-labelledby="availability-title">
          <div className={styles.availabilityCopy}>
            <span className={styles.icon}><PublicIcon name="calendar" /></span>
            <div>
              <h2 id="availability-title">Próxima evaluación dental</h2>
              <p>Consulta la agenda de demostración. El horario se selecciona al reservar.</p>
            </div>
          </div>
          <NextAppointment />
        </section>

        <section id="primera-visita" className={styles.visit} aria-labelledby="first-visit-title">
          <div className={`shell ${styles.visitInner}`}>
            <div className={styles.visitCopy}>
              <h2 id="first-visit-title">Tu primera visita</h2>
              <p>Un espacio para hablar de lo que necesitas y decidir los siguientes pasos con el profesional.</p>
              <ol className={styles.steps}>
                <li><strong>Elige un horario</strong><span>Selecciona una evaluación si todavía tienes dudas.</span></li>
                <li><strong>Comparte tus inquietudes</strong><span>Trae las preguntas que quieras resolver en la consulta.</span></li>
                <li><strong>Revisa las opciones</strong><span>Pregunta por lo que incluye cada alternativa y su costo.</span></li>
              </ol>
            </div>
            <div id="equipo" className={styles.team}>
              <h3>Equipo de atención</h3>
              <p>Perfiles de demostración. Al reservar puedes elegir un profesional o buscar el primer horario disponible.</p>
              <ul>
                {professionals.map((professional) => (
                  <li key={professional.id}>
                    <span className={styles.icon}><PublicIcon name="professional" /></span>
                    <div><strong>{professional.name}</strong><span>{professional.title}</span></div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section id="preguntas" className={`shell ${styles.section} ${styles.faq}`} aria-labelledby="faq-title">
          <div className={styles.sectionHeading}>
            <h2 id="faq-title">Preguntas frecuentes</h2>
            <Link className={styles.textLink} href="/mi-cita">Ayuda con una cita existente</Link>
          </div>
          <div className={styles.questions}>
            {questions.map(({ question, answer }) => (
              <details key={question}>
                <summary>{question}</summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section id="ubicacion" className={styles.locationSection} aria-labelledby="location-title">
          <div className={`shell ${styles.locationInner}`}>
            <div>
              <h2 id="location-title">Horario y ubicación</h2>
              <dl className={styles.hours}>
                <div><dt>Ciudad</dt><dd>{clinic.location}</dd></div>
                <div><dt>Horario de demostración</dt><dd>{publicHours}</dd></div>
              </dl>
            </div>
            <Link href="/reservar" className="button">Reservar cita <PublicIcon name="arrow" /></Link>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={`shell ${styles.footerInner}`}>
          <ClinicBrand />
          <nav aria-label="Enlaces de ayuda">
            <a href="#preguntas">Preguntas frecuentes</a>
            <Link href="/privacidad">Privacidad</Link>
            <Link href="/ingresar">Acceso del equipo</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
