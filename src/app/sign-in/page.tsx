import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { getIdentity } from "@/lib/auth";
import { safeNextPath } from "@/lib/auth-navigation";

export const dynamic = "force-dynamic";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNextPath((await searchParams).next);
  if (await getIdentity()) redirect(next);
  return <AuthForm mode="sign-in" next={next} />;
}
