import { randomBytes } from "node:crypto";
import { getDb } from "./db";
import { HttpError, verifyOrigin } from "./http";
import { digest, verifyPassword } from "./password";

export type Role = "ADMIN" | "RECEPCION" | "ODONTOLOGO";
export type User = { id: string; name: string; role: Role; professionalId: string | null };
type Account = User & { passwordHash: string };

const cookieName = "dental_session";
const duration = 8 * 60 * 60;
const tokenPattern = /^[a-f0-9]{64}$/;

function tokenFrom(request: Request) {
  const cookie = request.headers.get("cookie")?.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(cookieName + "="));
  const token = cookie?.slice(cookieName.length + 1);
  return token && tokenPattern.test(token) ? token : null;
}

function cookie(request: Request, token: string, maxAge: number) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return cookieName + "=" + token + "; Path=/; HttpOnly; SameSite=Strict; Max-Age=" + maxAge + secure;
}

export async function currentUser(request: Request) {
  const token = tokenFrom(request);
  if (!token) return null;
  const db = await getDb();
  const result = await db.query<User>(`
    SELECT u.id, u.name, u.role, u.professional_id AS "professionalId"
      FROM sessions s JOIN users u ON s.user_id = u.id
      WHERE s.token_hash = $1 AND s.expires_at > now()
  `, [digest(token)]);
  return result.rows[0] ?? null;
}

export async function requireUser(request: Request, roles?: Role[]) {
  if (request.method !== "GET" && request.method !== "HEAD") verifyOrigin(request);
  const user = await currentUser(request);
  if (!user) throw new HttpError(401, "Inicia sesión para continuar.");
  if (roles && !roles.includes(user.role)) throw new HttpError(403, "Tu rol no tiene acceso a esta acción.");
  return user;
}

export async function login(request: Request, email: string, password: string) {
  const db = await getDb();
  const users = await db.query<Account>(`
    SELECT id, name, role, professional_id AS "professionalId", password_hash AS "passwordHash"
      FROM users WHERE email = $1
  `, [email.toLowerCase()]);
  const account = users.rows[0];
  if (!account || !verifyPassword(password, account.passwordHash)) {
    throw new HttpError(401, "El correo o la contraseña no coinciden.");
  }
  const token = randomBytes(32).toString("hex");
  const previous = tokenFrom(request);
  await db.transaction(async (tx) => {
    await tx.query("DELETE FROM sessions WHERE expires_at <= now() OR token_hash = $1", [previous && digest(previous)]);
    await tx.query("INSERT INTO sessions VALUES ($1,$2,$3)", [
      digest(token), account.id, new Date(Date.now() + duration * 1000),
    ]);
  });
  const user: User = { id: account.id, name: account.name, role: account.role, professionalId: account.professionalId };
  return Response.json({ user }, { headers: { "Set-Cookie": cookie(request, token, duration) } });
}

export async function logout(request: Request) {
  verifyOrigin(request);
  const token = tokenFrom(request);
  if (token) await (await getDb()).query("DELETE FROM sessions WHERE token_hash = $1", [digest(token)]);
  return Response.json({ user: null }, { headers: { "Set-Cookie": cookie(request, "", 0) } });
}
