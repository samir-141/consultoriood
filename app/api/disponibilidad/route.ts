import { api } from "@/lib/http";
import { availability } from "@/lib/scheduling";

export function GET(request: Request) {
  return api(async () => Response.json({ slots: await availability(new URL(request.url).searchParams) }));
}
