import { api, readJson } from "@/lib/http";
import { hold } from "@/lib/scheduling";

export function POST(request: Request) {
  return api(async () => Response.json(await hold(await readJson(request)), { status: 201 }));
}
