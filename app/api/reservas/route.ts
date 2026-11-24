import { api, readJson } from "@/lib/http";
import { enforceLocalRequestLimit } from "@/lib/request-limit";
import { hold } from "@/lib/scheduling";

export function POST(request: Request) {
  return api(async () => {
    const body = await readJson(request);
    enforceLocalRequestLimit("booking");
    const booking = await hold(body, request.headers.get("idempotency-key"));
    return Response.json(booking, { status: 201 });
  });
}
