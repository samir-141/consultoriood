import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ClinicBrand } from "@/app/components/clinic-brand";
import { LocationMap } from "@/app/components/location-map";
import { PublicIcon } from "@/app/components/public-icon";
import { SiteNavbar } from "@/app/components/site-navbar";
import { TestimonialsCarousel } from "@/app/components/testimonials-carousel";
import { clinic, openingHours, professionals } from "@/config/site";
import {
  clinicDifferentiators,
  heroPhoto,
  heroSpecialistPhoto,
  landingTreatments,
  publicDescription,
  trustIndicators,
  whatsappUrl,
} from "./public-content";
import { publicSiteOrigin } from "./public-url";
import styles from "./landing.module.css";

const origin = publicSiteOrigin();
const leadDoctor = professionals[0];

export const metadata: Metadata = {
  title: `${clinic.fullName} · Odontología en Huamanga, Ayacucho`,
  description: publicDescription,
  ...(origin && { alternates: { canonical: origin } }),
  openGraph: {
    title: `${clinic.fullName} - ${clinic.heroHeadline}`,
    description: clinic.valueProposition,
    type: "website",
    locale: "es_PE",
    siteName: clinic.fullName,
    ...(origin && {
      url: origin,
      images: [{ url: new URL(heroSpecialistPhoto, origin), alt: "Especialista de Gómez Delgado Clínica Dental" }],
    }),
  },
};

export default function HomePage() {
  return (
    <div className={styles.site}>
      <a href="#contenido" className={styles.skip}>
        Saltar al contenido
      </a>

      {/* 01. BARRA DE NAVEGACIÓN */}
      <SiteNavbar />

      <main id="contenido" tabIndex={-1}>
        {/* 02. PORTADA PRINCIPAL (HERO) */}
        <section id="inicio" className={styles.heroContainer} aria-labelledby="hero-title">
          {/* Ondas orgánicas decorativas conectando con la identidad visual */}
          <svg
            className={styles.heroWaveTop}
            viewBox="0 0 480 140"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M0 0H420C330 45 255 110 140 92C70 81 26 112 0 136V0Z"
              fill="#B983BE"
              fillOpacity="0.22"
            />
            <path
              d="M0 0H340C250 38 190 88 95 72C48 64 18 82 0 98V0Z"
              fill="#7B247F"
              fillOpacity="0.14"
            />
          </svg>

          <svg
            className={styles.heroWaveBottom}
            viewBox="0 0 1440 120"
            preserveAspectRatio="none"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M0 84C240 16 480 12 720 62C960 112 1200 102 1440 34V120H0V84Z"
              fill="#B983BE"
              fillOpacity="0.28"
            />
            <path
              d="M0 98C260 44 520 42 780 84C1040 124 1260 96 1440 58V120H0V98Z"
              fill="#7B247F"
              fillOpacity="0.16"
            />
          </svg>

          <div className={`shell ${styles.heroGrid}`}>
            <div className={styles.heroCopy}>
              <span className={styles.heroBadge}>ODONTOLOGÍA INTEGRAL Y ESPECIALIZADA</span>

              <h1 id="hero-title" className={styles.heroTitle}>
                {clinic.heroHeadline}
              </h1>

              <p className={styles.heroLead}>{clinic.valueProposition}</p>

              <div className={styles.heroActions}>
                <a
                  href={whatsappUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`button ${styles.heroCtaPrimary}`}
                >
                  <PublicIcon name="whatsapp" />
                  <span>AGENDA TU CITA</span>
                </a>
                <a href="#servicios" className="button-secondary">
                  Ver tratamientos
                </a>
              </div>

              <div className={styles.heroQuickInfo}>
                <span className={styles.heroQuickItem}>
                  <PublicIcon name="location" />
                  <span>{clinic.address}</span>
                </span>
                <span className={styles.heroQuickItem}>
                  <PublicIcon name="clock" />
                  <span>{openingHours}</span>
                </span>
              </div>
            </div>

            <div className={styles.heroMediaWrap}>
              <div className={styles.heroMediaBackdrop}>
                <div className={styles.heroOrganicBack} aria-hidden="true" />
                <div className={styles.heroOrganicMid} aria-hidden="true" />
                <div className={styles.heroImageFrame}>
                  <Image
                    src={heroSpecialistPhoto}
                    alt="Especialista dental sonriendo con uniforme morado en Gómez Delgado Clínica Dental"
                    fill
                    sizes="(max-width: 959px) 340px, 440px"
                    className={styles.heroImage}
                    priority
                    fetchPriority="high"
                  />
                </div>
                <div className={styles.heroFloatingTag}>
                  <PublicIcon name="shield" />
                  <div>
                    <strong>{clinic.fullName}</strong>
                    <span>{clinic.location}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 03. BARRA DE CONFIANZA (TRUST BAR) */}
        <section className={styles.trustBar} aria-label="Pilares de confianza">
          <div className="shell">
            <ul className={styles.trustList}>
              {trustIndicators.map((indicator) => (
                <li key={indicator} className={styles.trustItem}>
                  <PublicIcon name="check" />
                  <span>{indicator}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 04. ESPECIALIDADES Y SERVICIOS */}
        <section id="servicios" className={styles.sectionTint} aria-labelledby="services-title">
          <div className="shell">
            <div className={styles.sectionHeading}>
              <span className={styles.sectionEyebrow}>Especialidades Odontológicas</span>
              <h2 id="services-title">Nuestros Tratamientos</h2>
              <p>
                Soluciones odontológicas integrales pensadas para cuidar tu salud bucal y devolverle seguridad a tu sonrisa.
              </p>
            </div>

            <div className={styles.servicesGrid}>
              {landingTreatments.map((treatment) => (
                <article key={treatment.id} className={styles.serviceCard}>
                  <div className={styles.serviceIconCircle}>
                    <PublicIcon name={treatment.icon} />
                  </div>
                  <h3>{treatment.title}</h3>
                  <p>{treatment.description}</p>
                  <a
                    href={whatsappUrl(treatment.whatsappMessage)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.serviceWhatsAppLink}
                  >
                    <span>Consultar por WhatsApp →</span>
                  </a>
                </article>
              ))}
            </div>

            <p className={styles.onlineBookingBar}>
              ¿Prefieres elegir tu horario directamente?{" "}
              <Link href="/reservar" className={styles.onlineBookingLink}>
                Reserva tu evaluación en línea aquí →
              </Link>
            </p>
          </div>
        </section>

        {/* 05. SOBRE LA CLÍNICA (FACTOR HUMANO) */}
        <section id="nosotros" className={styles.sectionWhite} aria-labelledby="about-title">
          <div className="shell">
            <div className={styles.aboutGrid}>
              <div className={styles.aboutImageWrap}>
                <Image
                  src={heroPhoto}
                  alt="Consulta cercana y cálida en el consultorio de Gómez Delgado Clínica Dental"
                  fill
                  sizes="(max-width: 899px) 100vw, 48vw"
                  className={styles.aboutImage}
                />
              </div>

              <div className={styles.aboutCopy}>
                <span className={styles.sectionEyebrow}>Sobre la Clínica</span>
                <h2 id="about-title">Trato humano, puntualidad y diagnóstico honesto</h2>
                <p>{leadDoctor.bio}</p>

                <div className={styles.aboutDoctorMeta}>
                  <strong>{leadDoctor.name}</strong>
                  <span>·</span>
                  <span>{leadDoctor.title} — {leadDoctor.specialty}</span>
                </div>

                <ul className={styles.differentiatorsList}>
                  {clinicDifferentiators.map((point) => (
                    <li key={point} className={styles.differentiatorItem}>
                      <span className={styles.differentiatorIcon}>
                        <PublicIcon name="check" />
                      </span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* 06. TESTIMONIOS DE PACIENTES */}
        <section className={styles.sectionTint} aria-labelledby="testimonials-title">
          <div className="shell">
            <div className={styles.sectionHeading}>
              <span className={styles.sectionEyebrow}>Pacientes Reales</span>
              <h2 id="testimonials-title">Sonrisas que respaldan nuestro trabajo</h2>
              <p>La tranquilidad y confianza de quienes nos visitan en Huamanga es nuestra mejor recomendación.</p>
            </div>

            <TestimonialsCarousel />
          </div>
        </section>

        {/* 07. UBICACIÓN Y CONTACTO DIRECTO */}
        <section id="ubicacion" className={styles.sectionWhite} aria-labelledby="location-title">
          <div className="shell">
            <div className={styles.sectionHeading}>
              <span className={styles.sectionEyebrow}>Visítanos en Huamanga</span>
              <h2 id="location-title">Ubicación y Contacto Directo</h2>
              <p>Estamos en el centro de la ciudad para que llegues fácil y recibas atención sin demoras.</p>
            </div>

            <div className={styles.locationGrid}>
              <div className={styles.contactInfoPanel}>
                <ul className={styles.contactDetailsList}>
                  <li className={styles.contactDetailItem}>
                    <span className={styles.contactIconCircle}>
                      <PublicIcon name="location" />
                    </span>
                    <div>
                      <span className={styles.contactDetailLabel}>Dirección</span>
                      <span className={styles.contactDetailValue}>{clinic.address}</span>
                    </div>
                  </li>

                  <li className={styles.contactDetailItem}>
                    <span className={styles.contactIconCircle}>
                      <PublicIcon name="whatsapp" />
                    </span>
                    <div>
                      <span className={styles.contactDetailLabel}>WhatsApp / Teléfono</span>
                      <a href={`tel:${clinic.phone.replace(/\s+/g, "")}`} className={styles.contactDetailValue}>
                        {clinic.phone}
                      </a>
                    </div>
                  </li>

                  <li className={styles.contactDetailItem}>
                    <span className={styles.contactIconCircle}>
                      <PublicIcon name="mail" />
                    </span>
                    <div>
                      <span className={styles.contactDetailLabel}>Correo electrónico</span>
                      <a href={`mailto:${clinic.email}`} className={styles.contactDetailValue}>
                        {clinic.email}
                      </a>
                    </div>
                  </li>

                  <li className={styles.contactDetailItem}>
                    <span className={styles.contactIconCircle}>
                      <PublicIcon name="clock" />
                    </span>
                    <div>
                      <span className={styles.contactDetailLabel}>Horarios de atención</span>
                      <span className={styles.contactDetailValue}>{openingHours} (Domingos previa coordinación)</span>
                    </div>
                  </li>
                </ul>

                <a
                  href={whatsappUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="button"
                  style={{ width: "100%" }}
                >
                  <PublicIcon name="whatsapp" />
                  <span>ESCRIBIR POR WHATSAPP</span>
                </a>
              </div>

              <LocationMap
                address={clinic.address ?? clinic.addressPlaceholder}
                embedUrl={clinic.mapEmbedUrl}
                mapUrl={clinic.mapUrl}
              />
            </div>
          </div>
        </section>
      </main>

      {/* 08. PIE DE PÁGINA (FOOTER) */}
      <footer className={styles.footer}>
        <div className="shell">
          <div className={styles.footerGrid}>
            <div className={styles.footerBrandCol}>
              <ClinicBrand href="#inicio" variant="light" />
              <p className={styles.footerSlogan}>
                Odontología integral y especializada en un ambiente cálido y seguro en el corazón de Huamanga.
              </p>
            </div>

            <div>
              <h2 className={styles.footerHeading}>Enlaces rápidos</h2>
              <nav aria-label="Enlaces del pie de página">
                <ul className={styles.footerNavList}>
                  <li><a href="#inicio">Inicio</a></li>
                  <li><a href="#servicios">Servicios</a></li>
                  <li><a href="#nosotros">Nosotros</a></li>
                  <li><a href="#ubicacion">Contacto</a></li>
                </ul>
              </nav>
            </div>

            <div>
              <h2 className={styles.footerHeading}>Contacto directo</h2>
              <ul className={styles.footerContactList}>
                <li>{clinic.address}</li>
                <li>
                  <a href={`tel:${clinic.phone.replace(/\s+/g, "")}`}>{clinic.phone}</a>
                </li>
                <li>
                  <a href={`mailto:${clinic.email}`}>{clinic.email}</a>
                </li>
              </ul>

              <div className={styles.socialRow} aria-label="Redes sociales y mensajería">
                <a
                  href="https://www.facebook.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.socialLink}
                  aria-label="Facebook de Gómez Delgado Clínica Dental"
                >
                  <PublicIcon name="facebook" />
                </a>
                <a
                  href="https://www.instagram.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.socialLink}
                  aria-label="Instagram de Gómez Delgado Clínica Dental"
                >
                  <PublicIcon name="instagram" />
                </a>
                <a
                  href={whatsappUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.socialLink}
                  aria-label="WhatsApp de Gómez Delgado Clínica Dental"
                >
                  <PublicIcon name="whatsapp" />
                </a>
              </div>
            </div>
          </div>

          <div className={styles.footerBottom}>
            <p style={{ margin: 0 }}>© 2026 Gómez Delgado Clínica Dental. Todos los derechos reservados.</p>
            <Link href="/privacidad">Política de Privacidad</Link>
          </div>
        </div>
      </footer>

      {/* BOTÓN FLOTANTE DE WHATSAPP */}
      <a
        href={whatsappUrl()}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.floatingWhatsapp}
        aria-label="Agendar cita por WhatsApp"
      >
        <PublicIcon name="whatsapp" />
        <span className={styles.floatingWhatsappLabel}>WhatsApp</span>
      </a>
    </div>
  );
}
