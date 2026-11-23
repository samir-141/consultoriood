import { requireUser } from "@/lib/auth";
import { api, readJson } from "@/lib/http";
import { agenda, changeAgenda } from "@/lib/scheduling";

export function GET(request: Request) {
  return api(async () => {
    const user = await requireUser(request);
    return Response.json(await agenda(new URL(request.url).searchParams, user));
  });
}

export function POST(request: Request) {
  return api(async () => {
    const user = await requireUser(request);
    return Response.json(await changeAgenda(await readJson(request), user));
  });
}
