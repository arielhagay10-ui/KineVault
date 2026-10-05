import { execFile, execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { expect, test as base } from "@playwright/test";
import { z } from "zod";
import type { Database } from "../../src/lib/database.types";

const run = promisify(execFile);
type PublishedExercise = { name: string; slug: string };

function localSql(statement: string) {
  execFileSync("docker", ["exec", "supabase_db_kinevault", "psql", "-U", "postgres", "-d", "postgres",
    "-v", "ON_ERROR_STOP=1", "-c", statement], { stdio: "pipe" });
}

// Seed exercises deliberately remain unpublished until their original media is
// reviewed. Browser catalog checks use their own real rendered publication.
export const test = base.extend<object, { publishedCableRaise: PublishedExercise }>({
  publishedCableRaise: [async ({}, useFixture, workerInfo) => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    if (!["127.0.0.1", "localhost"].includes(new URL(url).hostname)) {
      throw new Error("Published catalog fixtures require local Supabase");
    }
    const auth = { persistSession: false, autoRefreshToken: false };
    const service = createClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth });
    const owner = createClient<Database>(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth });
    const visitor = createClient<Database>(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth });
    const suffix = randomUUID();
    const email = `catalog-${suffix}@example.test`;
    const password = "LocalCatalogFixture2026!";
    const name = "Cable Lateral Raise";
    const slug = `cable-lateral-raise-${suffix}`;
    const account = await service.auth.admin.createUser({ email, password, email_confirm: true });
    if (account.error) throw account.error;
    const userId = z.uuid().parse(account.data.user.id);
    try {
      localSql(`update public.roles set role = 'reviewer' where user_id = '${userId}';`);
      expect((await owner.auth.signInWithPassword({ email, password })).error).toBeNull();
      const draft = await owner.rpc("save_private_exercise", {
        p_name: name, p_family_slug: "lateral-raise", p_primary_muscle_slugs: ["lateral-deltoid"],
        p_joint_action_slugs: ["shoulder-abduction"], p_equipment_slugs: ["cable"],
      });
      if (draft.error) throw draft.error;
      const scene = await owner.rpc("save_private_scene", { p_private_id: draft.data!, p_scene: {
        durationMs: 500, cameraAngle: "front", equipment: { slug: "single-cable", x: 0, y: 0, z: 0, scale: 1 },
        keyframes: [{ timeMs: 0, poses: { "left-shoulder": { z: 0 } } },
          { timeMs: 500, poses: { "left-shoulder": { z: -70 } } }],
      } });
      if (scene.error) throw scene.error;
      const submitted = await owner.rpc("submit_private_exercise", {
        p_private_id: draft.data!, p_duplicate_disposition: "new",
      });
      if (submitted.error) throw submitted.error;
      const submissionId = z.uuid().parse(submitted.data);
      const submission = await owner.from("exercise_submissions").select("original_content_id")
        .eq("id", submissionId).single();
      if (submission.error) throw submission.error;
      const contentId = z.uuid().parse(submission.data.original_content_id);

      // Leave other queued development jobs intact; move only this job first.
      localSql(`update public.render_jobs job set queued_at = '1970-01-01'
        where job.status = 'queued' and job.scene_id in
        (select id from public.exercise_scenes where content_id = '${contentId}');`);
      await run(process.execPath, ["scripts/render-worker.mjs", "--once"], {
        timeout: 120_000, env: { ...process.env, RENDER_APP_URL: workerInfo.project.use.baseURL },
      });
      const readMedia = async () => {
        const media = await owner.from("exercise_media").select("kind,storage_path")
          .eq("content_id", contentId).eq("storage_bucket", "exercise-private");
        if (media.error) throw media.error;
        return media.data;
      };
      // Concurrent fixture workers may claim one another's queued jobs. Wait
      // for this submission's complete asset set before copying or approving.
      await expect.poll(async () => (await readMedia()).map(asset => asset.kind).sort(), { timeout: 30_000 })
        .toEqual(["mp4", "poster", "webm"]);
      for (const asset of await readMedia()) {
        const extension = asset.kind === "poster" ? "webp" : asset.kind;
        const copied = await service.storage.from("exercise-private").copy(asset.storage_path,
          `submissions/${submissionId}/demo.${extension}`, { destinationBucket: "exercise-public" });
        if (copied.error) throw copied.error;
      }
      const review = await owner.rpc("begin_submission_review", { p_submission_id: submissionId });
      if (review.error) throw review.error;
      const approved = await owner.rpc("approve_submission", { p_submission_id: submissionId, p_slug: slug });
      if (approved.error) throw approved.error;
      const published = await visitor.from("exercises").select("slug").eq("id", approved.data!).single();
      expect(published.error).toBeNull();
      expect(published.data?.slug).toBe(slug);
      await useFixture({ name, slug });
    } finally {
      // Retain immutable review history, remove only this fixture from Explore,
      // and do not leave the fixture account with reviewer privileges.
      localSql(`update public.exercises set status = 'withdrawn'
        where created_by = '${userId}' and status = 'published';
        update public.roles set role = 'user' where user_id = '${userId}';`);
      const remaining = await visitor.from("exercises").select("id").eq("created_by", userId);
      expect(remaining.error).toBeNull();
      expect(remaining.data).toEqual([]);
      await owner.auth.signOut();
    }
  }, { scope: "worker", timeout: 180_000 }],
});
