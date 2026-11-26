import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Merriweather, Montserrat } from "next/font/google";
import { clinic } from "@/config/site";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-montserrat",
});

const merriweather = Merriweather({
  subsets: ["latin"],
  weight: ["700", "900"],
  display: "swap",
  variable: "--font-merriweather",
});

export const metadata: Metadata = {
  title: { default: `${clinic.name} · ${clinic.descriptor}`, template: `%s · ${clinic.name}` },
  description: `${clinic.name} ${clinic.descriptor} - ${clinic.valueProposition}`,
  icons: {
    icon: [
      { url: "/identidad/logo.png", type: "image/png", sizes: "192x192" },
      { url: "/identidad/logo-96.webp", type: "image/webp", sizes: "96x96" },
    ],
    apple: [{ url: "/identidad/logo.png", sizes: "192x192", type: "image/png" }],
  },
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#3B1143",
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="es-PE" data-scroll-behavior="smooth" className={`${montserrat.variable} ${merriweather.variable}`}>
      <body className={montserrat.className}>
        {children}
      </body>
    </html>
  );
}
