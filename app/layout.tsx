import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import { clinic } from "@/config/site";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: { default: `${clinic.name} · ${clinic.descriptor}`, template: `%s · ${clinic.name}` },
  description: `${clinic.name} - ${clinic.valueProposition}`,
  icons: { icon: { url: "/identidad/marca.svg", type: "image/svg+xml", sizes: "any" } },
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a2540",
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="es-PE" className={inter.variable}>
      <body className={inter.className}>
        {children}
      </body>
    </html>
  );
}
