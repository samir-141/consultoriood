import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClinicBrand } from "@/app/components/clinic-brand";
import { PublicIcon } from "@/app/components/public-icon";
import { clinic, professionals } from "@/lib/catalog";
import { publicServices, servicePrice } from "../../public-content";
import { publicSiteOrigin } from "../../public-url";
import styles from "../../landing.module.css";

type Props = { params: Promise<{ servicio: string }> };

export function generateStaticParams() {
  return publicServices.map(({ id }) => ({ servicio: id }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { servicio } = await params;
  const service = publicServices.find(({ id }) => id === servicio);
  if (!service) notFound();

  const title = `${service.name} en Huamanga`;
  const origin = publicSiteOrigin();
  const url = origin ? new URL(`/servicios/${service.id}`, origin) : undefined;
  return {
    title,
    description: service.description,
    ...(url && { alternates: { canonical: url } }),
    openGraph: { title, description: service.description, type: "website", locale: "es_PE", url },
  };
}

export default async function ServicePage({ params }: Props) {
  const { servicio } = await params;
  const service = publicServices.find(({ id }) => id === servicio);
  if (!service) notFound();
  const availableProfessionals = professionals.filter(({ serviceIds }) => serviceIds.includes(service.id));

  return (
    <main className={`shell ${styles.detail}`}>
      <ClinicBrand />
      <div className={styles.detailsBack}><Link href="/#servicios" className={styles.textLink}>Volver a servicios</Link></div>
      <article className="panel">
        <h1>{service.name}</h1>
        <p>{service.description}</p>
        <h2>Qué puedes consultar</h2>
        <p>{service.visit}</p>
        <h2>Duración y precio referencial</h2>
        <p>{service.duration} minutos · {servicePrice(service.priceCents)}</p>
        {availableProfessionals.length > 0 && (
          <>
            <h2>Equipo disponible en el catálogo</h2>
            <p>{availableProfessionals.map(({ name }) => name).join(" · ")}</p>
          </>
        )}
        <div className={styles.detailActions}>
          <Link className="button" href={`/reservar?servicio=${service.id}`}>
            Ver horarios <PublicIcon name="arrow" />
          </Link>
        </div>
        {clinic.demo && <p className={styles.demo}>Servicio de demostración. Usa datos ficticios al reservar.</p>}
      </article>
    </main>
  );
}
