import "server-only";
import { cookies } from "next/headers";
import { z } from "zod";
import { safeNextPath } from "./auth-navigation";
import { getAuthSettings } from "./auth-settings";

export const authEmailSchema = z.string().trim().pipe(z.email().max(254));
export const emailKindSchema = z.enum(["signup", "recovery"]);
const pendingSchema = z.object({
  email: authEmailSchema,
  kind: emailKindSchema,
  next: z.string().max(2048),
  retryAt: z.number().int().nonnegative(),
  expiresAt: z.number().int().nonnegative(),
});
type PendingEmail = z.infer<typeof pendingSchema>;
const cookieName = "kv-auth-email";
export const resendDelayMs = 60_000;

/** Presentation and browser cooldown only. This cookie never establishes identity. */
export async function getPendingEmail(): Promise<(PendingEmail & { remainingSeconds: number }) | null> {
  const value = (await cookies()).get(cookieName)?.value;
  if (!value || value.length > 4096) return null;
  try {
    const parsed = pendingSchema.safeParse(JSON.parse(value));
    const now = Date.now();
    if (!parsed.success || parsed.data.expiresAt <= now || parsed.data.retryAt > now + resendDelayMs) return null;
    return { ...parsed.data, next: safeNextPath(parsed.data.next), remainingSeconds: Math.max(0, Math.ceil((parsed.data.retryAt - now) / 1000)) };
  } catch {
    return null;
  }
}

export async function rememberPendingEmail(input: Pick<PendingEmail, "email" | "kind" | "next">, sent = true) {
  const previous = await getPendingEmail();
  const retryAt = sent ? Date.now() + resendDelayMs : previous?.retryAt ?? 0;
  const pending = pendingSchema.parse({ ...input, next: safeNextPath(input.next), retryAt, expiresAt: Date.now() + 3600_000 });
  (await cookies()).set(cookieName, JSON.stringify(pending), {
    httpOnly: true, sameSite: "lax", secure: getAuthSettings().siteUrl.startsWith("https:"), path: "/", maxAge: 3600,
  });
  return pending;
}

export async function clearPendingEmail() {
  (await cookies()).delete(cookieName);
}
