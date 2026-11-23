import type { Metadata } from "next";
import { professionals, services } from "@/lib/catalog";
import BookingFlow from "./booking-flow";

export const metadata: Metadata = {
  title: "Reserva tu cita",
  description: "Elige un servicio y un horario para tu cita dental.",
};

export default function BookingPage() {
  return <BookingFlow catalog={{ services, professionals }} />;
}
