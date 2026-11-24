import type { Metadata } from "next";
import { clinic, professionals, services } from "@/lib/catalog";
import BookingFlow from "./booking-flow";

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
  return (
    <BookingFlow
      key={initialServiceId}
      catalog={{ services, professionals }}
      initialServiceId={initialServiceId}
      location={clinic.location}
    />
  );
}
