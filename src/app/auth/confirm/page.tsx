import type { Metadata } from "next";
import { ConfirmEmailForm } from "@/components/auth/confirm-email-form";
import { emailNextPath, safeNextPath } from "@/lib/auth-navigation";
import { getAuthSettings } from "@/lib/auth-settings";
import { getPendingEmail } from "@/lib/auth-pending-email";
import { confirmationSchema } from "@/lib/auth-confirmation";

export const metadata: Metadata = { title: "Confirm your email | KineVault", referrer: "no-referrer", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ConfirmEmailPage({ searchParams }: {
  searchParams: Promise<{ token_hash?: string; type?: string; next?: string; redirect_to?: string }>;
}) {
  const params = await searchParams;
  const confirmation = confirmationSchema.safeParse(params);
  const pending = await getPendingEmail();
  const next = params.redirect_to ? emailNextPath(params.redirect_to, getAuthSettings().siteUrl) : safeNextPath(params.next ?? pending?.next);
  return <ConfirmEmailForm tokenHash={confirmation.data?.token_hash ?? null} type={params.type === "recovery" ? "recovery" : "email"} next={next} />;
}
