export const clinic = {
  name: "Consultorio dental",
  location: "Lima, Perú",
  timeZone: "America/Lima",
  hours: "Lunes a sábado, 9:00 a. m. a 5:00 p. m.",
  demo: true,
};

export const services = [
  { id: "evaluacion", name: "Evaluación dental", description: "Primera consulta para conversar sobre tu salud bucal y conocer los siguientes pasos.", duration: 30, priceCents: 8000 },
  { id: "limpieza", name: "Limpieza dental", description: "Atención preventiva con orientación para el cuidado diario.", duration: 45, priceCents: 12000 },
  { id: "control", name: "Control dental", description: "Revisión de seguimiento después de una consulta o tratamiento.", duration: 30, priceCents: 9000 },
];

export const professionals = [
  { id: "odonto-a", name: "Odontóloga A", title: "Odontología general", serviceIds: ["evaluacion", "limpieza", "control"] },
  { id: "odonto-b", name: "Odontólogo B", title: "Evaluación y seguimiento", serviceIds: ["evaluacion", "control"] },
];
