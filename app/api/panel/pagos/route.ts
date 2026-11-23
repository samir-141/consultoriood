import { readPayments, writePayment } from "@/lib/payments";
import { api } from "@/lib/http";

export async function GET(request: Request) {
  return api(() => readPayments(request));
}

export async function POST(request: Request) {
  return api(() => writePayment(request));
}
