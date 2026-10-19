import type { Metadata } from "next";
import { CheckEmailForm } from "@/components/auth/check-email-form";
import { safeNextPath } from "@/lib/auth-navigation";
import { emailKindSchema, getPendingEmail } from "@/lib/auth-pending-email";

export const metadata: Metadata = { title: "Check your email | KineVault", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function CheckEmailPage({ searchParams }: { searchParams: Promise<{ kind?: string; next?: string }> }) {
  const params = await searchParams;
  const pending = await getPendingEmail();
  const kind = emailKindSchema.safeParse(params.kind).data ?? pending?.kind ?? "signup";
  const email = pending?.kind === kind ? pending.email : "";
  const retryAt = pending?.retryAt ?? 0;
  return <CheckEmailForm email={email} kind={kind} next={safeNextPath(params.next ?? pending?.next)}
    retryAt={retryAt} initialSeconds={pending?.remainingSeconds ?? 0} />;
}
