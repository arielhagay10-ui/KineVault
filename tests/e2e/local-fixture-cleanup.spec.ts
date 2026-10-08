import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { cleanupLocalFixture } from "../helpers/local-fixtures";

for (const auditLinked of [false, true]) test(`local cleanup removes drafts and ${auditLinked ? "retains audit-linked identity" : "removes ordinary identity"}`, async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw new Error("Local fixtures required");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const email = `cleanup-${randomUUID()}@example.test`, password = "CleanupFixture2026!";
  const account = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (account.error) throw account.error;
  const userId = account.data.user.id;
  let cleaned = false;
  try {
    const owner = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    const signedIn = await owner.auth.signInWithPassword({ email, password });
    if (signedIn.error) throw signedIn.error;
    const draft = await owner.rpc("save_private_exercise", { p_name: "Cleanup test draft" });
    if (draft.error) throw draft.error;
    const sql = (query: string) => execFileSync("docker", ["exec", "supabase_db_kinevault", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-At", "-c", query], { encoding: "utf8" }).trim();
    if (auditLinked) sql(`insert into public.admin_events(actor_id, object_type, object_id, operation, after_value)
      values ('${userId}', 'qa_cleanup', '${userId}', 'INSERT', '{"fixture":true}');`);
    await cleanupLocalFixture({ admin, userId, email, password, owner });
    cleaned = true;
    expect(sql(`select count(*) from public.private_exercises where owner_id = '${userId}';`)).toBe("0");
    expect(sql(`select count(*) from public.exercise_content where kind = 'private_draft' and owner_id = '${userId}';`)).toBe("0");
    if (auditLinked) {
      expect(sql(`select count(*) from public.admin_events where actor_id = '${userId}';`)).toBe("1");
      expect(sql(`select deleted_at is not null from auth.users where id = '${userId}';`)).toBe("t");
    } else expect(sql(`select count(*) from auth.users where id = '${userId}';`)).toBe("0");
    expect((await owner.auth.signInWithPassword({ email, password })).error).not.toBeNull();
  } finally {
    if (!cleaned) await cleanupLocalFixture({ admin, userId, email, password });
  }
});
