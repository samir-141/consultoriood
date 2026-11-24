import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { clinic } from "@/lib/catalog";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: `${clinic.name} · ${clinic.descriptor}`, template: `%s · ${clinic.name}` },
  description: "Reserva una cita dental y gestiona tu atención en Lima, Perú.",
  icons: { icon: { url: "/identidad/marca.svg", type: "image/svg+xml", sizes: "any" } },
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f9f5fa",
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="es-PE">
      <body>
        {children}
      </body>
    </html>
  );
}
