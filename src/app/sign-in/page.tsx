import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { getIdentity } from "@/lib/auth";
import { safeNextPath } from "@/lib/auth-navigation";
import { getAuthSettings } from "@/lib/auth-settings";

export const dynamic = "force-dynamic";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; callback?: string; confirmation?: string; reset?: string }> }) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  if (await getIdentity()) redirect(next);
  const initialError = params.callback === "canceled" ? "Google sign-in was canceled. Try again or sign in with your email."
    : params.callback === "failed" ? "We could not finish Google sign-in. Try again or sign in with your email."
    : params.confirmation === "failed" ? "Your confirmation link has expired or has already been used. Request a new link."
    : params.reset === "expired" ? "Your reset session has expired. Use Forgot password to request a new link." : null;
  return <AuthForm mode="sign-in" next={next} googleEnabled={getAuthSettings().googleEnabled} initialError={initialError} confirmationFailed={params.confirmation === "failed"} />;
}
