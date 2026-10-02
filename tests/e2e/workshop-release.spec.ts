import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { machineDemoScene, machineSlugs } from "../../src/lib/motion/studio-machines";
import { createStudioObject } from "../../src/lib/motion/studio";
import { blankWorkshopScene, identityTransform } from "../../src/lib/motion/workshop";

test.use({ launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader"] } });

test("leave equipment from the toolbar, move independently, undo and save", async ({ page }) => {
  test.setTimeout(180_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw Error("Local fixtures required");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const email = `release-${Date.now()}@example.test`, password = "ReleaseFixture2026!";
  const account = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (account.error) throw account.error;
  const owner = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  await owner.auth.signInWithPassword({ email, password });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  try {
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    for (const slug of [...machineSlugs, "bench"] as const) {
      const id = randomUUID();
      const scene = slug === "bench" ? { ...blankWorkshopScene, studio: {
        body: { ...identityTransform }, objects: [createStudioObject("bench", id, 0)], seating: { benchId: id, facing: "front" as const },
      } } : machineDemoScene(slug, id);
      const equipment = scene.studio!.objects[0];
      const created = await owner.rpc("create_workshop_exercise", { p_scene: scene });
      if (created.error) throw created.error;
      await page.goto(`/my-exercises/${created.data}/workshop`);
      await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
      const toolbar = page.getByRole("toolbar", { name: "Workshop tools" });
      const release = toolbar.getByRole("button", { name: slug === "bench" ? "Stand up" : "Leave machine", exact: true });
      await expect(release).toBeVisible();
      // The exit stays available when equipment, rather than the body, is selected.
      await page.getByLabel("Scene objects").getByRole("button", { name: equipment.name, exact: true }).click();
      await release.click();
      await expect(release).toHaveCount(0);
      await expect(page.getByLabel("Position X", { exact: true })).toBeEnabled();
      await toolbar.getByRole("button", { name: "Undo", exact: true }).click();
      await expect(release).toBeVisible();
      await toolbar.getByRole("button", { name: "Redo", exact: true }).click();
      await expect(release).toHaveCount(0);
      await page.getByLabel("Position X", { exact: true }).fill("2");
      await page.getByRole("button", { name: "Save scene", exact: true }).click();
      await expect(page.getByText("Scene saved privately.", { exact: true })).toBeVisible();
      await page.reload();
      await expect(page.getByLabel("Position X", { exact: true })).toHaveValue("2");
      await expect(release).toHaveCount(0);
      await page.getByLabel("Scene objects").getByRole("button", { name: equipment.name, exact: true }).click();
      await expect(page.getByLabel("Position X", { exact: true })).toHaveValue(String(equipment.x));
      if (slug === "bench") await page.getByRole("button", { name: "Face away from bench", exact: true }).click();
      else await page.getByRole("button", { name: "Use this machine", exact: true }).click();
      await expect(release).toBeVisible();
    }
    expect(errors).toEqual([]);
  } finally {
    await admin.auth.admin.deleteUser(account.data.user.id);
  }
});
