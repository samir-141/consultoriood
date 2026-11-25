type PracticeLocation = {
  id: string;
  name: string;
  address: string | null;
  addressPlaceholder?: string;
  mapUrl: string | null;
};

type DentalService = {
  id: string;
  name: string;
  description: string;
  duration: number;
  priceCents: number;
  icon: "evaluacion" | "limpieza" | "control";
  intent: string;
  visit: string;
};

export const schedule = {
  workingDays: [1, 2, 3, 4, 5, 6], // Lunes a sábado (domingos no laborables)
  openingHour: 9,
  closingHour: 17,
  slotMinutes: 15,
  displayStepMinutes: 30,
  bufferMinutes: 0,
  minAdvanceMinutes: 15, // Reserva en línea requiere mínimo 15 min de anticipación
  horizonDays: 90,
};

export const clinic = {
  name: "GOMEZ DELGADO DENTAL",
  descriptor: "Clínica Odontológica",
  city: "Huamanga",
  region: "Ayacucho",
  country: "Perú",
  location: "Huamanga, Ayacucho, Perú",
  timeZone: "America/Lima",
  address: null as string | null,
  addressPlaceholder: "Dirección exacta por confirmar (Centro de Huamanga, Ayacucho)",
  mapUrl: null as string | null,
  mapPlaceholder: "Mapa interactivo en preparación",
  phone: "+51 966 000 000",
  email: "contacto@gomezdelgadodental.pe",
  valueProposition: "Atención odontológica integral, cercana y con tecnología moderna en el corazón de Huamanga.",
  heroHeadline: "Cuidamos tu sonrisa con excelencia y calidez.",
  heroSubheadline: "Atención odontológica personalizada por el Lic. Edu Gómez Delgado en Huamanga, Ayacucho.",
  walkInNotice:
    "Si ya pasaste los 15 min previos al turno o necesitas atención inmediata, se aceptan consultas presenciales directamente en el consultorio (con posible espera).",
  demo: true,
};

export const clinics: PracticeLocation[] = [
  {
    id: "huamanga",
    name: clinic.name,
    address: clinic.address,
    addressPlaceholder: clinic.addressPlaceholder,
    mapUrl: clinic.mapUrl,
  },
];

export const professionals = [
  {
    id: "odonto-a",
    name: "Edu Gómez Delgado",
    title: "Lic. en Odontología",
    specialty: "Odontología Integral y Estética",
    bio: "Profesional colegiado comprometido con la salud oral, prevención y tratamientos dentales de alta precisión y calidad humana.",
    serviceIds: ["evaluacion", "limpieza", "control"],
  },
];

export const services: DentalService[] = [
  {
    id: "evaluacion",
    name: "Evaluación dental",
    duration: 30,
    priceCents: 8000,
    icon: "evaluacion",
    description: "Diagnóstico completo, conversación sobre tu salud bucal y planificación de siguientes pasos.",
    intent: "Para una primera visita o si tienes dudas sobre qué tratamiento requieres.",
    visit: "Cuéntale al profesional qué te preocupa y qué quieres resolver. Podrás preguntar por las alternativas, los tiempos y el costo antes de decidir.",
  },
  {
    id: "limpieza",
    name: "Limpieza dental",
    duration: 45,
    priceCents: 12000,
    icon: "limpieza",
    description: "Profilaxis y atención preventiva con orientación para el cuidado diario.",
    intent: "Para agendar una visita preventiva y remover placa bacteriana.",
    visit: "Comenta tus dudas sobre el cuidado diario. El profesional podrá explicar el alcance de la visita y orientarte acerca de los cuidados posteriores.",
  },
  {
    id: "control",
    name: "Control dental",
    duration: 30,
    priceCents: 9000,
    icon: "control",
    description: "Revisión periódica de seguimiento después de una consulta o tratamiento.",
    intent: "Para el seguimiento después de una consulta o un tratamiento.",
    visit: "Si recibiste indicaciones en tu visita anterior, tenlas a mano. Puedes comentar cambios y aclarar los siguientes pasos del seguimiento.",
  },
];

const weekdayNames = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const scheduleDays = [...schedule.workingDays].sort((first, second) => first - second);
const consecutive = scheduleDays.length > 1 && scheduleDays.every((day, index) => day === scheduleDays[0] + index);
const days = consecutive
  ? `${weekdayNames[scheduleDays[0]]} a ${weekdayNames[scheduleDays[scheduleDays.length - 1]]}`
  : new Intl.ListFormat("es-PE").format(scheduleDays.map((day) => weekdayNames[day]));
const hours = [schedule.openingHour, schedule.closingHour].map((hour) => `${String(hour).padStart(2, "0")}:00`).join("–");

export const openingHours = days ? `${days[0].toLocaleUpperCase("es-PE")}${days.slice(1)} · ${hours}` : "Horario por confirmar";
