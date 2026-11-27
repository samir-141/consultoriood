import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { currentUserFromToken, sanitizePanelRedirect, SESSION_COOKIE } from "@/lib/auth";
import { SignInForm } from "./SignInForm";

type SignInPageProps = Readonly<{
  searchParams: Promise<{ next?: string | string[] }>;
}>;

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const nextPath = sanitizePanelRedirect(params.next);
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const user = await currentUserFromToken(token);

  if (user) {
    redirect(nextPath);
  }

  return <SignInForm nextPath={nextPath} />;
}
