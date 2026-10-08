import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test as base } from "@playwright/test";
import { createStudioObject } from "../../src/lib/motion/studio";
import { defaultScene, identityTransform } from "../../src/lib/motion/workshop";
import { workshopSceneSchema } from "../../src/lib/motion/scene-schema";
import { hardwareProfileOptions } from "../../scripts/lib/hardware-profile.mjs";
import { dismissWorkshopTutorial } from "../e2e/workshop-menu.helpers";
import { cleanupLocalFixture } from "../helpers/local-fixtures";

export const fixtureWorkload = "workshop-shoulder-abduction-static-dumbbell-v1";

export const test = base.extend<{ hardwareFixture: { draftId: string } }>({
  hardwareFixture: async ({ page }, provide) => {
    hardwareProfileOptions(process.env);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const owner = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    const email = `hardware-${randomUUID()}@example.test`, password = `Hardware-${randomUUID()}!`;
    const account = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (account.error) throw account.error;
    try {
      const signedIn = await owner.auth.signInWithPassword({ email, password });
      if (signedIn.error) throw signedIn.error;
      const scene = structuredClone(defaultScene);
      scene.equipment = null;
      scene.studio = { body: { ...identityTransform }, objects: [
        { ...createStudioObject("dumbbell", randomUUID(), 0), x: 1.4, y: 1.1, z: 0, attachment: "none" },
      ] };
      const draft = await owner.rpc("save_workshop_draft", { p_scene: workshopSceneSchema.parse(scene), p_name: "Disposable hardware workload" });
      if (draft.error) throw draft.error;
      await page.goto("/sign-in");
      await page.getByLabel("Email", { exact: true }).fill(email);
      await page.getByLabel("Password", { exact: true }).fill(password);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(page).toHaveURL(/\/dashboard$/);
      await page.goto(`/my-exercises/${draft.data}/workshop?metrics=1`);
      await dismissWorkshopTutorial(page);
      await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
      await provide({ draftId: draft.data });
    } finally {
      try { await page.close(); }
      finally { await cleanupLocalFixture({ admin, userId: account.data.user.id, email, password, owner }); }
    }
  },
});
