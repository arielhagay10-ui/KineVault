import { AuthForm } from "@/components/auth/auth-form";
import { safeNextPath } from "@/lib/auth-navigation";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  return <AuthForm mode="forgot" next={safeNextPath((await searchParams).next)} />;
}
