import { api, readJson } from "@/lib/http";
import { enforceLocalRequestLimit } from "@/lib/request-limit";
import { dailyReservasAvailability, hold, monthlyReservasAvailability } from "@/lib/scheduling";
import { validateReservasCreate, validateReservasQuery } from "@/lib/reservas-validation";

export function GET(request: Request) {
  return api(async () => {
    const url = new URL(request.url);
    const { month } = validateReservasQuery(url.searchParams);
    if (month) {
      const data = await monthlyReservasAvailability(url.searchParams);
      return Response.json(data, { status: 200 });
    }
    const data = await dailyReservasAvailability(url.searchParams);
    return Response.json(data, { status: 200 });
  });
}

export function POST(request: Request) {
  return api(async () => {
    const rawBody = await readJson(request);
    const body = validateReservasCreate(rawBody);
    enforceLocalRequestLimit("booking");
    const booking = await hold(body, request.headers.get("idempotency-key"));
    return Response.json(booking, { status: 201 });
  });
}
