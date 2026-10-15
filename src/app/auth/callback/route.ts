import { NextResponse, type NextRequest } from "next/server";
import { authPath, safeNextPath } from "@/lib/auth-navigation";
import { getAuthSettings } from "@/lib/auth-settings";
import { clearPendingEmail } from "@/lib/auth-pending-email";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { siteUrl } = getAuthSettings();
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  const failure = (reason: "canceled" | "failed") => NextResponse.redirect(new URL(`${authPath("/sign-in", next)}&callback=${reason}`, siteUrl));
  if (request.nextUrl.searchParams.has("error")) return failure(request.nextUrl.searchParams.get("error") === "access_denied" ? "canceled" : "failed");
  const code = request.nextUrl.searchParams.get("code");
  if (!code) return failure("failed");
  const supabase = await createClient();
  const result = await supabase.auth.exchangeCodeForSession(code).catch(() => null);
  if (!result || result.error) return failure("failed");
  await clearPendingEmail();
  return NextResponse.redirect(new URL(next, siteUrl));
}
