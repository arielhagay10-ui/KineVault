import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { getIdentity } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function UpdatePasswordPage() {
  if (!await getIdentity()) redirect("/sign-in");
  return <AuthForm mode="update" />;
}
