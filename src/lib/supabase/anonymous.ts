import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { fetchSupabase } from "./fetch-server";

/** Public reads only. No request cookies, storage, or persisted user session. */
export function createAnonymousClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Public Supabase environment variables are missing");
  return createClient<Database>(url, key, {
    global: { fetch: fetchSupabase },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
