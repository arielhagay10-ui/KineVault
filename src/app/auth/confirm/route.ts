import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { safeNextPath } from "@/lib/auth-navigation";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = z.enum(["email", "recovery"]).safeParse(request.nextUrl.searchParams.get("type"));
  if (!tokenHash || !type.success) return NextResponse.redirect(new URL("/sign-in", request.url));

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type.data as EmailOtpType });
  if (error) return NextResponse.redirect(new URL("/sign-in?confirmation=failed", request.url));
  const fallback = type.data === "recovery" ? "/reset-password/update" : "/dashboard";
  const next = safeNextPath(request.nextUrl.searchParams.get("next"), fallback);
  return NextResponse.redirect(new URL(next, request.url));
}
