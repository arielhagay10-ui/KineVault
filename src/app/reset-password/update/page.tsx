import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { getIdentity } from "@/lib/auth";
import { authPath, safeNextPath } from "@/lib/auth-navigation";

export const dynamic = "force-dynamic";

export default async function UpdatePasswordPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNextPath((await searchParams).next);
  if (!await getIdentity()) redirect(`${authPath("/sign-in", next)}&reset=expired`);
  return <AuthForm mode="update" next={next} />;
}
