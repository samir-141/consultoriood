import { api } from "@/lib/http";
import { nextAvailability } from "@/lib/scheduling";

export function GET(request: Request) {
  return api(async () => Response.json({ slot: await nextAvailability(new URL(request.url).searchParams) }));
}
