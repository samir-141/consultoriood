import { api, readJson } from "@/lib/http";
import { enforceLocalRequestLimit } from "@/lib/request-limit";
import { manageAppointment, patientAppointment } from "@/lib/scheduling";

type Context = { params: Promise<{ token: string }> };

export function GET(request: Request, { params }: Context) {
  return api(async () => {
    enforceLocalRequestLimit("token", request);
    return Response.json({ appointment: await patientAppointment((await params).token) });
  });
}

export function POST(request: Request, { params }: Context) {
  return api(async () => {
    enforceLocalRequestLimit("token", request);
    return Response.json({ appointment: await manageAppointment((await params).token, await readJson(request)) });
  });
}
