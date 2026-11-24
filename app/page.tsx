import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ClinicBrand } from "@/app/components/clinic-brand";
import { PublicIcon } from "@/app/components/public-icon";
import { clinic, openingHours, professionals, services } from "@/config/site";
import { heroPhoto, publicDescription, servicePrice } from "./public-content";
import { publicSiteOrigin } from "./public-url";
import styles from "./landing.module.css";

const origin = publicSiteOrigin();
const leadDoctor = professionals[0];

export const metadata: Metadata = {
  title: `${clinic.name} · Odontología en Huamanga, Ayacucho`,
  description: publicDescription,
  ...(origin && { alternates: { canonical: origin } }),
  openGraph: {
    title: `${clinic.name} - ${leadDoctor.name}`,
    description: clinic.valueProposition,
    type: "website",
    locale: "es_PE",
    siteName: clinic.name,
    ...(origin && {
      url: origin,
      images: [{ url: new URL(heroPhoto, origin), alt: "Consulta Odontológica en Huamanga" }],
    }),
  },
};

const questions = [
  {
    question: "¿Cuánto cuesta y cuánto dura una evaluación dental?",
    answer:
      "La evaluación dental dura 30 minutos y tiene un costo referencial de S/ 80.00. Incluye diagnóstico visual integral, revisión de historial clínico y presupuesto detallado.",
  },
  {
    question: "¿Cómo reservo una cita?",
    answer:
      "Elige el día en nuestro calendario, consulta los horarios disponibles en tiempo real, ingresa tus datos básicos y confirma tu turno de manera inmediata.",
  },
  {
    question: "¿Cómo cambio o cancelo mi cita?",
    answer:
      "Al reservar recibirás un enlace exclusivo para consultar, reprogramar o cancelar tu turno con total comodidad.",
  },
  {
    question: "¿Dónde queda la clínica en Huamanga?",
    answer: `Nos ubicamos en la ciudad de Huamanga, Ayacucho, Perú. ${clinic.addressPlaceholder}.`,
  },
];

export default function HomePage() {
  return (
    <div className={styles.site}>
      <a href="#contenido" className={styles.skip}>
        Saltar al contenido
      </a>

      {/* Navegación Pública (Sin enlaces a login ni admin) */}
      <header className={styles.top}>
        <div className={`shell ${styles.header}`}>
          <ClinicBrand />
          <nav className={styles.navigation} aria-label="Navegación principal">
            <a href="#servicios">Servicios</a>
            <a href="#profesional">El Profesional</a>
            <a href="#ubicacion">Ubicación y Horario</a>
            <a href="#contacto">Contacto</a>
          </nav>
          <Link className={styles.headerAction} href="/reservar">
            Reservar cita <PublicIcon name="arrow" />
          </Link>
        </div>
      </header>

      <main id="contenido" tabIndex={-1}>
        {/* HERO A PANTALLA COMPLETA (100svh) */}
        <section className={styles.heroContainer} aria-labelledby="hero-title">
          <div className={styles.heroSplit}>
            <div className={styles.heroCopyWrap}>
              <div className={styles.heroCopy}>
                <div className={styles.badge}>
                  <PublicIcon name="location" />
                  <span>{clinic.location}</span>
                </div>

                <div className={styles.professionalIntro}>
                  <span className={styles.professionalTitle}>{leadDoctor.title}</span>
                  <h1 id="hero-title" className={styles.professionalName}>
                    {leadDoctor.name}
                  </h1>
                  <p className={styles.clinicTagline}>{clinic.heroHeadline}</p>
                </div>

                <p className={styles.heroLead}>{clinic.valueProposition}</p>

                <div className={styles.heroActions}>
                  <Link href="/reservar" className="button">
                    Reservar cita <PublicIcon name="arrow" />
                  </Link>
                  <a href="#servicios" className="button-secondary">
                    Ver tratamientos
                  </a>
                </div>

                <div className={styles.heroPillars}>
                  <div className={styles.pillarItem}>
                    <PublicIcon name="shield" />
                    <span>Atención sin dolor</span>
                  </div>
                  <div className={styles.pillarItem}>
                    <PublicIcon name="check" />
                    <span>Tecnología moderna</span>
                  </div>
                  <div className={styles.pillarItem}>
                    <PublicIcon name="clock" />
                    <span>Puntualidad en tu cita</span>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.heroImageWrap}>
              <Image
                src={heroPhoto}
                alt="Atención odontológica en consultorio dental Gómez Delgado"
                fill
                sizes="(max-width: 960px) 100vw, 50vw"
                className={styles.heroImage}
                priority
              />
              <div className={styles.heroImageBadge}>
                <PublicIcon name="shield" />
                <div>
                  <strong>{clinic.name}</strong>
                  <span>Huamanga, Ayacucho</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECCIÓN 1: SERVICIOS */}
        <section id="servicios" className={`shell ${styles.section}`} aria-labelledby="services-title">
          <div className={styles.sectionHeading}>
            <h2 id="services-title">Nuestros Servicios Odontológicos</h2>
            <p>Atención personalizada con equipamiento moderno y procedimientos seguros para toda la familia.</p>
          </div>

          <div className={styles.servicesGrid}>
            {services.map((service) => (
              <article key={service.id} className={styles.serviceCard}>
                <div className={styles.serviceIcon}>
                  <PublicIcon name={service.icon} />
                </div>
                <h3>{service.name}</h3>
                <p>{service.description}</p>
                <div className={styles.serviceMeta}>
                  <span className={styles.serviceDuration}>
                    <PublicIcon name="clock" /> {service.duration} min
                  </span>
                  <strong className={styles.servicePrice}>{servicePrice(service.priceCents)}</strong>
                </div>
                <Link href={`/reservar?servicio=${service.id}`} className={styles.serviceBtn}>
                  Reservar este servicio <PublicIcon name="arrow" />
                </Link>
              </article>
            ))}
          </div>
        </section>

        {/* SECCIÓN 2: SOBRE EL PROFESIONAL */}
        <section id="profesional" className={styles.sectionAlt} aria-labelledby="doctor-title">
          <div className="shell">
            <div className={styles.sectionHeading}>
              <h2 id="doctor-title">Sobre el Profesional</h2>
              <p>Experiencia, dedicación y calidez en cada consulta odontológica.</p>
            </div>

            <div className={styles.doctorCard}>
              <div className={styles.doctorAvatar}>
                <PublicIcon name="professional" />
              </div>
              <div className={styles.doctorInfo}>
                <span className={styles.doctorBadge}>{leadDoctor.title}</span>
                <h3>{leadDoctor.name}</h3>
                <div className={styles.doctorDegree}>{leadDoctor.specialty}</div>
                <p className={styles.doctorBio}>{leadDoctor.bio}</p>
                <div className={styles.doctorHighlights}>
                  <div className={styles.highlightItem}>
                    <PublicIcon name="check" /> Instrumental 100% esterilizado
                  </div>
                  <div className={styles.highlightItem}>
                    <PublicIcon name="check" /> Diagnóstico claro y honesto
                  </div>
                  <div className={styles.highlightItem}>
                    <PublicIcon name="check" /> Tratamientos sin dolor y confort
                  </div>
                  <div className={styles.highlightItem}>
                    <PublicIcon name="check" /> Puntualidad en tus horarios
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECCIÓN 3: UBICACIÓN Y HORARIOS */}
        <section id="ubicacion" className={`shell ${styles.section}`} aria-labelledby="location-title">
          <div className={styles.sectionHeading}>
            <h2 id="location-title">Ubicación y Horario de Atención</h2>
            <p>Atención presencial en la histórica ciudad de Huamanga.</p>
          </div>

          <div className={styles.locationGrid}>
            <div className={styles.infoCard}>
              <h3>
                <PublicIcon name="location" /> Datos de Localización
              </h3>
              <dl className={styles.infoList}>
                <div className={styles.infoItem}>
                  <dt>Ciudad y Región</dt>
                  <dd>{clinic.location}</dd>
                </div>
                <div className={styles.infoItem}>
                  <dt>Dirección</dt>
                  <dd>
                    {clinic.address ? (
                      clinic.address
                    ) : (
                      <div className={styles.addressPlaceholderNotice}>
                        <PublicIcon name="location" /> {clinic.addressPlaceholder}
                      </div>
                    )}
                  </dd>
                </div>
                <div className={styles.infoItem}>
                  <dt>Horario de Atención</dt>
                  <dd>{openingHours}</dd>
                </div>
                <div className={styles.infoItem}>
                  <dt>Días no laborables</dt>
                  <dd>Domingos y feriados declarados</dd>
                </div>
              </dl>
            </div>

            <div className={styles.mapPlaceholderCard}>
              <PublicIcon name="location" />
              <strong>{clinic.mapPlaceholder}</strong>
              <p>
                Próximamente compartiremos el plano interactivo de Google Maps para tu fácil llegada al consultorio.
              </p>
              <div className={styles.addressPlaceholderNotice}>Huamanga, Ayacucho, Perú</div>
            </div>
          </div>
        </section>

        {/* SECCIÓN 4: CONTACTO Y RESERVA */}
        <section id="contacto" className={styles.contactSection} aria-labelledby="contact-title">
          <div className={`shell ${styles.contactInner}`}>
            <div className={styles.contactCopy}>
              <h2 id="contact-title">¿Tienes preguntas o deseas reservar?</h2>
              <p>
                Agenda tu cita en línea en menos de 2 minutos o comunícate directamente con nuestro equipo de atención.
              </p>
              <div className={styles.contactChannels}>
                <a href={`tel:${clinic.phone}`} className={styles.channelItem}>
                  <PublicIcon name="phone" /> {clinic.phone}
                </a>
                <a href={`mailto:${clinic.email}`} className={styles.channelItem}>
                  <PublicIcon name="mail" /> {clinic.email}
                </a>
                <div className={styles.channelItem}>
                  <PublicIcon name="clock" /> {openingHours}
                </div>
              </div>
            </div>

            <div className={styles.contactCard}>
              <h3>Reserva tu turno ahora</h3>
              <p>Selecciona fecha y hora disponible sin intermediarios ni demoras.</p>
              <Link href="/reservar" className={styles.ctaBookingBtn}>
                Ir al flujo de reserva <PublicIcon name="arrow" />
              </Link>
            </div>
          </div>
        </section>

        {/* PREGUNTAS FRECUENTES */}
        <section className={`shell ${styles.section}`} aria-labelledby="faq-title">
          <div className={styles.sectionHeading}>
            <h2 id="faq-title">Preguntas Frecuentes</h2>
            <p>Respuestas a las dudas más comunes de nuestros pacientes.</p>
          </div>
          <div style={{ display: "grid", gap: "1rem", maxWidth: "48rem", marginInline: "auto" }}>
            {questions.map(({ question, answer }) => (
              <details key={question} className="panel">
                <summary style={{ cursor: "pointer", color: "var(--blue-deep)" }}>{question}</summary>
                <p style={{ marginTop: "0.5rem", color: "var(--muted)", lineHeight: 1.6 }}>{answer}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      {/* FOOTER PÚBLICO (Sin login visible) */}
      <footer className={styles.footer}>
        <div className={`shell ${styles.footerInner}`}>
          <div>
            <ClinicBrand />
            <p className={styles.copyright}>
              © {new Date().getFullYear()} {clinic.name}. {clinic.location}.
            </p>
          </div>
          <nav className={styles.footerNav} aria-label="Enlaces secundarios">
            <a href="#servicios">Servicios</a>
            <a href="#profesional">El Profesional</a>
            <a href="#ubicacion">Ubicación</a>
            <Link href="/privacidad">Política de Privacidad</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
