import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { currentUserFromToken, SESSION_COOKIE } from "@/lib/auth";
import { StaffShell } from "./panel-shell";

export default async function StaffLayout({ children }: { children: ReactNode }) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const user = await currentUserFromToken(token);

  if (!user) {
    redirect("/ingresar");
  }

  return <StaffShell initialStaff={user}>{children}</StaffShell>;
}
