import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type AppRole = Database["public"]["Enums"]["app_role"];

async function readIdentity(): Promise<{ userId: string; role: AppRole } | null> {
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

// React caches only this render request; no identities enter the shared data cache.
export const getIdentity = cache(readIdentity);

export async function requireRole(allowed: readonly AppRole[]) {
  // Mutations always recheck the current claims and database role.
  const identity = await readIdentity();
  if (!identity || !allowed.includes(identity.role)) {
    throw new Error("Forbidden");
  }
  return identity;
}
