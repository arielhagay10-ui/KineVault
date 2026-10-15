import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { getIdentity } from "@/lib/auth";
import { safeNextPath } from "@/lib/auth-navigation";
import { getAuthSettings } from "@/lib/auth-settings";

export const dynamic = "force-dynamic";

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNextPath((await searchParams).next);
  if (await getIdentity()) redirect(next);
  return <AuthForm mode="sign-up" next={next} googleEnabled={getAuthSettings().googleEnabled} />;
}
