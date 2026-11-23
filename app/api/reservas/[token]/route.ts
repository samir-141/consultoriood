import { api, readJson } from "@/lib/http";
import { manageAppointment, patientAppointment } from "@/lib/scheduling";

type Context = { params: Promise<{ token: string }> };

export function GET(_request: Request, { params }: Context) {
  return api(async () => Response.json({ appointment: await patientAppointment((await params).token) }));
}

export function POST(request: Request, { params }: Context) {
  return api(async () => Response.json({ appointment: await manageAppointment((await params).token, await readJson(request)) }));
}
