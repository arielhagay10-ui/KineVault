import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { execFileSync } from "node:child_process";

export async function cleanupLocalFixture({ admin, userId, email, password, owner }: {
  admin: SupabaseClient;
  userId: string;
  email: string;
  password: string;
  owner?: SupabaseClient;
}) {
  // Inspect the actual client destination, not only the environment's URL.
  const url = (admin as unknown as { supabaseUrl: string }).supabaseUrl;
  const destination = new URL(url);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(destination.hostname)
    || !["http:", "https:"].includes(destination.protocol)) {
    throw new Error("Fixture cleanup requires local Supabase");
  }
  z.uuid().parse(userId);
  if (!/^[a-z0-9][a-z0-9._+-]*@example\.test$/i.test(email)) {
    throw new Error("Fixture cleanup requires an explicit fixture email");
  }
  const account = await admin.auth.admin.getUserById(userId);
  if (account.error) throw account.error;
  if (account.data.user.email !== email) throw new Error("Fixture ID does not match its email");

  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!key) throw new Error("Fixture cleanup requires the local publishable key");
  const authenticated = owner ?? createClient(url, key, { auth: { persistSession: false } });
  if ((authenticated as unknown as { supabaseUrl: string }).supabaseUrl !== url) {
    throw new Error("Fixture owner requires the same local Supabase");
  }
  const signedIn = await authenticated.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw signedIn.error;
  if (signedIn.data.user.id !== userId) throw new Error("Fixture owner does not match its ID");
  let softDelete = false;
  try {
    const drafts = await authenticated.from("private_exercises").select("id").eq("owner_id", userId);
    if (drafts.error) throw drafts.error;
    for (const draft of drafts.data) {
      const deleted = await authenticated.rpc("delete_private_exercise", { p_private_id: z.uuid().parse(draft.id) });
      if (deleted.error) throw deleted.error;
    }
    const remaining = await authenticated.from("private_exercises").select("id").eq("owner_id", userId);
    if (remaining.error) throw remaining.error;
    if (remaining.data.length) throw new Error("Fixture drafts remain after cleanup");
    // Local SQL checks audit references without granting service_role table access.
    const references = execFileSync("docker", ["exec", "supabase_db_kinevault", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-At", "-c",
      `select exists(select 1 from public.exercise_submissions where owner_id = '${userId}')
        or exists(select 1 from public.moderation_reviews where reviewer_id = '${userId}')
        or exists(select 1 from public.moderation_events where actor_id = '${userId}')
        or exists(select 1 from public.admin_events where actor_id = '${userId}')
        or exists(select 1 from public.notifications where user_id = '${userId}');`], { encoding: "utf8" }).trim();
    if (!["t", "f"].includes(references)) throw new Error("Fixture audit references could not be checked");
    softDelete = references === "t";
    if (softDelete) {
      execFileSync("docker", ["exec", "supabase_db_kinevault", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c",
        `update public.roles set role = 'user' where user_id = '${userId}';
          delete from public.favorites where user_id = '${userId}';`], { stdio: "pipe" });
    }
  } finally {
    const signedOut = await authenticated.auth.signOut({ scope: "global" });
    if (signedOut.error) throw signedOut.error;
  }

  // Immutable submission/review/admin history retains its original account IDs.
  const removed = await admin.auth.admin.deleteUser(userId, softDelete);
  if (removed.error) throw removed.error;
  const verified = await admin.auth.admin.getUserById(userId);
  if (softDelete) {
    if (verified.error) throw verified.error;
    if (!verified.data.user.deleted_at) throw new Error("Fixture account was not soft deleted");
  } else if (!verified.error || verified.error.status !== 404) {
    throw verified.error ?? new Error("Fixture account remains after deletion");
  }
  const visitor = createClient(url, key, { auth: { persistSession: false } });
  const rejected = await visitor.auth.signInWithPassword({ email, password });
  if (!rejected.error) {
    await visitor.auth.signOut({ scope: "global" });
    throw new Error("Deleted fixture can still authenticate");
  }
}
