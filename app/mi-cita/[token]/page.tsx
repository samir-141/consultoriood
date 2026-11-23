import type { Metadata } from "next";
import AppointmentManagement from "./appointment-management";

export const metadata: Metadata = {
  title: "Mi cita",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function AppointmentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <AppointmentManagement token={token} />;
}
