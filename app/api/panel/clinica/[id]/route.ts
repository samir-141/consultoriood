import { readClinicalRecord, writeClinicalRecord } from "@/lib/clinical";
import { api } from "@/lib/http";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  return api(() => readClinicalRecord(request, id));
}

export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  return api(() => writeClinicalRecord(request, id));
}
