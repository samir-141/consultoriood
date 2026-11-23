import { uploadClinicalAttachment } from "@/lib/clinical";
import { api } from "@/lib/http";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return api(() => uploadClinicalAttachment(request, id));
}
