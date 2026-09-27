import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { getIdentity } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SignUpPage() {
  if (await getIdentity()) redirect("/dashboard");
  return <AuthForm mode="sign-up" />;
}
