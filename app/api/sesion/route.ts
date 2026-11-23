import { currentUser, login, logout } from "@/lib/auth";
import { api, field, readJson } from "@/lib/http";

export function GET(request: Request) {
  return api(async () => Response.json({ user: await currentUser(request) }));
}

export function POST(request: Request) {
  return api(async () => {
    const body = await readJson(request);
    return login(request, field(body.email, "correo", 160), field(body.password, "contraseña", 128));
  });
}

export function DELETE(request: Request) {
  return api(() => logout(request));
}
