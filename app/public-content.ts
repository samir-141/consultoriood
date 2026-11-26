import { clinic, services } from "@/lib/catalog";

export const publicServices = services;

const money = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" });

export function servicePrice(priceCents: number) {
  return money.format(priceCents / 100);
}

export const heroPhoto = "/fotografia/consulta-ilustrativa.webp";
export const heroSpecialistPhoto = "/fotografia/especialista-hero.webp";

export const publicDescription = `${clinic.fullName} en Huamanga, Ayacucho. Odontología integral y especializada. Agenda tu cita por WhatsApp.`;

export const defaultWhatsAppMessage = "Hola, quisiera agendar una cita en Gómez Delgado Clínica Dental";

export function whatsappUrl(message = defaultWhatsAppMessage) {
  return `https://wa.me/${clinic.whatsappDigits}?text=${encodeURIComponent(message)}`;
}

export const trustIndicators = [
  "Atención personalizada",
  "Equipos modernos y bioseguridad",
  "Especialistas certificados",
  "Ubicación céntrica — Av. Mariscal Cáceres #601",
] as const;

export type TreatmentCard = {
  id: string;
  title: string;
  description: string;
  icon: "limpieza" | "ortodoncia" | "estetica" | "endodoncia" | "implantes" | "odontopediatria";
  whatsappMessage: string;
};

export const landingTreatments: TreatmentCard[] = [
  {
    id: "profilaxis",
    title: "Profilaxis y Limpieza Dental",
    description: "Eliminación profunda de sarro y placa bacteriana con ultrasonido para encías sanas y aliento fresco.",
    icon: "limpieza",
    whatsappMessage: "Hola, quisiera consultar sobre Profilaxis y Limpieza Dental en Gómez Delgado Clínica Dental.",
  },
  {
    id: "ortodoncia",
    title: "Ortodoncia (Brackets y Alineadores)",
    description: "Corrección precisa de la mordida y alineación dental con seguimiento cercano en cada control.",
    icon: "ortodoncia",
    whatsappMessage: "Hola, quisiera consultar sobre Ortodoncia en Gómez Delgado Clínica Dental.",
  },
  {
    id: "estetica",
    title: "Estética y Blanqueamiento Dental",
    description: "Diseño de sonrisa, resinas estéticas y blanqueamiento seguro para iluminar tu expresión natural.",
    icon: "estetica",
    whatsappMessage: "Hola, quisiera consultar sobre Estética y Blanqueamiento Dental en Gómez Delgado Clínica Dental.",
  },
  {
    id: "endodoncia",
    title: "Endodoncia y Restauraciones",
    description: "Tratamientos de conducto sin dolor y curaciones duraderas que preservan tus piezas dentales.",
    icon: "endodoncia",
    whatsappMessage: "Hola, quisiera consultar sobre Endodoncia y Restauraciones en Gómez Delgado Clínica Dental.",
  },
  {
    id: "implantes",
    title: "Implantes y Prótesis Dentales",
    description: "Rehabilitación funcional y estética con materiales biocompatibles para volver a sonreír con confianza.",
    icon: "implantes",
    whatsappMessage: "Hola, quisiera consultar sobre Implantes y Prótesis Dentales en Gómez Delgado Clínica Dental.",
  },
  {
    id: "odontopediatria",
    title: "Odontopediatría",
    description: "Cuidado dental amigable, paciente y preventivo pensado especialmente para niños y adolescentes.",
    icon: "odontopediatria",
    whatsappMessage: "Hola, quisiera consultar sobre Odontopediatría en Gómez Delgado Clínica Dental.",
  },
];

export const clinicDifferentiators = [
  "Evaluación clara antes de cada procedimiento",
  "Materiales de alta calidad y bioseguridad rigurosa",
  "Seguimiento cercano post-tratamiento",
] as const;

export const patientTestimonials = [
  {
    id: "maria-r",
    quote:
      "Tenía mucho miedo de ir al dentista, pero desde la primera consulta me explicaron cada paso con mucha paciencia. Hoy termino mi tratamiento feliz.",
    author: "María R.",
    treatment: "Ortodoncia",
  },
  {
    id: "carlos-m",
    quote:
      "Excelente atención y puntualidad. El consultorio es súper limpio, moderno y te atienden justo a la hora acordada sin esperas incómodas.",
    author: "Carlos M.",
    treatment: "Profilaxis y Limpieza Dental",
  },
  {
    id: "lucia-v",
    quote:
      "Me realicé un blanqueamiento antes de un evento familiar y los resultados fueron muy naturales. Se nota el profesionalismo y trato humano.",
    author: "Lucía V.",
    treatment: "Estética y Blanqueamiento Dental",
  },
] as const;
