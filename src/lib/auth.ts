import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export async function getIdentity(): Promise<{ userId: string; role: AppRole } | null> {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claimsData?.claims.sub) {
    return null;
  }

  const { data: roleRow, error: roleError } = await supabase
    .from("roles")
    .select("role")
    .eq("user_id", claimsData.claims.sub)
    .single();
  if (roleError || !roleRow) {
    throw new Error("Authenticated user has no application role");
  }
  return { userId: claimsData.claims.sub, role: roleRow.role };
}

export async function requireRole(allowed: readonly AppRole[]) {
  const identity = await getIdentity();
  if (!identity || !allowed.includes(identity.role)) {
    throw new Error("Forbidden");
  }
  return identity;
}
