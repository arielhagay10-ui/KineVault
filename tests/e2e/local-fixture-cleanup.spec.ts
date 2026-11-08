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

test("local cleanup withdraws the fixture's open reviews without notifying it", async () => {
  test.setTimeout(60_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw new Error("Local fixtures required");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const email = `cleanup-review-${randomUUID()}@example.test`, password = "CleanupFixture2026!";
  const account = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (account.error) throw account.error;
  const userId = account.data.user.id;
  const sql = (query: string) => execFileSync("docker", ["exec", "supabase_db_kinevault", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-At", "-c", query], { encoding: "utf8" }).trim();
  let cleaned = false;
  try {
    sql(`update public.roles set role = 'reviewer' where user_id = '${userId}';`);
    const owner = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    const signedIn = await owner.auth.signInWithPassword({ email, password });
    if (signedIn.error) throw signedIn.error;
    const submissions: string[] = [];
    for (const name of ["Cleanup queued review", "Cleanup started review"]) {
      const draft = await owner.rpc("save_private_exercise", { p_name: name, p_family_slug: "lateral-raise",
        p_primary_muscle_slugs: ["lateral-deltoid"], p_joint_action_slugs: ["shoulder-abduction"] });
      if (draft.error) throw draft.error;
      const scene = await owner.rpc("save_private_scene", { p_private_id: draft.data, p_scene: { durationMs: 1000, cameraAngle: "front", equipment: null,
        keyframes: [{ timeMs: 0, poses: { "left-shoulder": { z: 0 } } }, { timeMs: 1000, poses: { "left-shoulder": { z: -70 } } }] } });
      if (scene.error) throw scene.error;
      const submitted = await owner.rpc("submit_private_exercise", { p_private_id: draft.data, p_duplicate_disposition: "new" });
      if (submitted.error) throw submitted.error;
      submissions.push(submitted.data);
    }
    const review = await owner.rpc("begin_submission_review", { p_submission_id: submissions[1] });
    if (review.error) throw review.error;
    await cleanupLocalFixture({ admin, userId, email, password, owner });
    cleaned = true;
    expect(sql(`select string_agg(status::text, ',') from public.exercise_submissions where owner_id = '${userId}';`)).toBe("withdrawn,withdrawn");
    expect(sql(`select string_agg(from_status::text, ',' order by from_status) from public.moderation_events
      where actor_id = '${userId}' and action = 'withdraw' and to_status = 'withdrawn';`)).toBe("submitted,in_review");
    expect(sql(`select count(*) from public.notifications where user_id = '${userId}';`)).toBe("0");
    expect(sql(`select count(*) from public.render_jobs where requested_by = '${userId}' and status = 'queued';`)).toBe("0");
    expect(sql(`select deleted_at is not null from auth.users where id = '${userId}';`)).toBe("t");
  } finally {
    if (!cleaned) await cleanupLocalFixture({ admin, userId, email, password });
  }
});
