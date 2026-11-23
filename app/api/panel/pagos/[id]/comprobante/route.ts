import { downloadPaymentProof } from "@/lib/payments";
import { api } from "@/lib/http";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return api(() => downloadPaymentProof(request, id));
}
