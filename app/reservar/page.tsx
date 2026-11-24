import type { Metadata } from "next";
import { clinic, professionals, services } from "@/lib/catalog";
import { limaDate } from "@/lib/clinic-time";
import { monthlyReservasAvailability } from "@/lib/scheduling";
import BookingFlow from "./booking-flow";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reserva tu cita",
  description: "Elige un servicio y un horario para tu cita dental.",
};

export default async function BookingPage({
  searchParams,
}: {
  searchParams: Promise<{ servicio?: string | string[] }>;
}) {
  const { servicio } = await searchParams;
  const initialServiceId = services.find(({ id }) => id === servicio)?.id ?? "";
  const effectiveService = initialServiceId || services[0]?.id || "evaluacion";
  const effectiveProf = professionals.length === 1 ? professionals[0].id : "any";
  const initialMonthData = await monthlyReservasAvailability(
    new URLSearchParams({
      mes: limaDate().slice(0, 7),
      servicio: effectiveService,
      profesional: effectiveProf,
    }),
  ).catch(() => null);

  return (
    <BookingFlow
      key={initialServiceId}
      catalog={{ services, professionals }}
      initialServiceId={initialServiceId}
      location={clinic.location}
      initialMonthData={initialMonthData}
    />
  );
}
