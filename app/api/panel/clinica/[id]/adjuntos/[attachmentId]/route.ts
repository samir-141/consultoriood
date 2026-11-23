import { downloadClinicalAttachment } from "@/lib/clinical";
import { api } from "@/lib/http";

type Context = { params: Promise<{ id: string; attachmentId: string }> };

export async function GET(request: Request, { params }: Context) {
  const { id, attachmentId } = await params;
  return api(() => downloadClinicalAttachment(request, id, attachmentId));
}
