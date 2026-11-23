import { clinic, professionals, services } from "@/lib/catalog";

export function GET() {
  return Response.json({ clinic, services, professionals });
}
