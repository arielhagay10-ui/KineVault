import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect } from "@playwright/test";
import { test as base } from "../e2e/published-catalog.helpers";
import { createStudioObject } from "../../src/lib/motion/studio";
import { blankWorkshopScene, type StudioObject, type WorkshopScene } from "../../src/lib/motion/workshop";
import { dismissWorkshopTutorial } from "../e2e/workshop-menu.helpers";
import { cleanupLocalFixture } from "../helpers/local-fixtures";

type WorkshopFixture = { userId: string; draftId: string; scene: WorkshopScene; weight: StudioObject };

export const test = base.extend<{ workshop: WorkshopFixture }>({
  workshop: async ({ page, baseURL }, provide) => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname)
      || !baseURL || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(baseURL).hostname)) {
      throw new Error("Readiness fixtures require local app and Supabase URLs");
    }
    const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const owner = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    const email = `readiness-${randomUUID()}@example.test`, password = `Readiness-${randomUUID()}!`;
    const account = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (account.error) throw account.error;
    try {
      const signedIn = await owner.auth.signInWithPassword({ email, password });
      if (signedIn.error) throw signedIn.error;
      const scene = structuredClone(blankWorkshopScene);
      const weight: StudioObject = { ...createStudioObject("dumbbell", randomUUID(), 0), x: 1.4, y: 1.1, z: 0, attachment: "none" };
      scene.studio!.objects = [weight];
      const draft = await owner.rpc("save_workshop_draft", { p_scene: scene, p_name: "Browser readiness fixture" });
      if (draft.error) throw draft.error;
      await page.goto("/sign-in");
      await page.getByLabel("Email", { exact: true }).fill(email);
      await page.getByLabel("Password", { exact: true }).fill(password);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(page).toHaveURL(/\/dashboard$/);
      await page.goto(`/my-exercises/${draft.data}/workshop`);
      await dismissWorkshopTutorial(page);
      await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
      await provide({ userId: account.data.user.id, draftId: draft.data, scene, weight });
    } finally {
      // Stop autosave before deleting only this fixture owner's records.
      try { await page.close(); }
      finally { await cleanupLocalFixture({ admin, userId: account.data.user.id, email, password, owner }); }
    }
  },
});
