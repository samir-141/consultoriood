import { clinic as business, openingHours } from "@/config/site";

export { clinics, professionals, schedule, services } from "@/config/site";

export const clinic = { ...business, hours: openingHours };
