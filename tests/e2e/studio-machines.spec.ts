import { openWorkshopTool, selectWorkshopObject, selectWorkshopJoint, jointField } from "./workshop-menu.helpers";
import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { machineDemoScene, machineSlugs, machineTravelLabels } from "../../src/lib/motion/studio-machines";
import { studioAssetNames } from "../../src/lib/motion/studio";

test.use({ launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader"] } });
test.beforeEach(async ({ page }) => page.setDefaultTimeout(15_000));

for (const { slug, grip } of [...machineSlugs.map(slug => ({ slug, grip: "supinated" as const })), { slug: "lat-pulldown-machine" as const, grip: "pronated" as const }]) {
  test(`machine carriages animate, save, reload and remain editable with supported contact: ${slug}${slug === "lat-pulldown-machine" ? ` ${grip}` : ""}`, async ({ page }) => {
    test.setTimeout(300_000);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw Error("Local fixtures required");
    const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const email = `machines-${randomUUID()}@example.test`, password = "MachineFixture2026!";
    const account = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (account.error) throw account.error;
    const owner = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    await owner.auth.signInWithPassword({ email, password });
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    try {
      await page.setViewportSize({ width: 1600, height: 1100 });
      await page.goto("/sign-in"); await page.getByLabel("Email", { exact: true }).fill(email); await page.getByLabel("Password", { exact: true }).fill(password);
      await page.getByRole("button", { name: "Sign in", exact: true }).click(); await expect(page).toHaveURL(/\/dashboard$/);
      const scene = machineDemoScene(slug, randomUUID(), grip);
      const created = await owner.rpc("create_workshop_exercise", { p_scene: scene });
      if (created.error) throw created.error;
      await page.goto(`/my-exercises/${created.data}/workshop`);
      await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60000 });
      await expect(page.locator("[data-highlight-count]")).not.toHaveAttribute("data-highlight-count", "0");
      await selectWorkshopObject(page, studioAssetNames[slug]);
      await openWorkshopTool(page, "Contacts");
      await expect(page.getByRole("button", { name: "Stop using machine", exact: true })).toHaveAttribute("aria-pressed", "true");
      await selectWorkshopObject(page, "Anatomical figure");
      await openWorkshopTool(page, "Position");
      await expect(page.getByText(`The figure follows ${studioAssetNames[slug]}. Select the machine to move it or change travel.`, { exact: true })).toBeVisible();
      await openWorkshopTool(page, "Pose");
      await selectWorkshopJoint(page, "Torso");
      await expect(jointField(page, "x")).toBeDisabled();
      await page.getByRole("button", { name: "Stop using machine to pose freely", exact: true }).click();
      await expect(jointField(page, "x")).toBeEnabled();
      await selectWorkshopObject(page, studioAssetNames[slug]);
      await openWorkshopTool(page, "Contacts");
      await page.getByRole("button", { name: "Use this machine", exact: true }).click();
      await openWorkshopTool(page, "Timeline");
      if (slug === "lat-pulldown-machine") await expect(page.getByLabel("Pulldown grip", { exact: true })).toHaveValue(grip);
      const artifacts = `.local-artifacts/machines/review/${slug}${slug === "lat-pulldown-machine" ? `-${grip}` : ""}`; mkdirSync(artifacts, { recursive: true });
      for (const view of grip === "pronated" ? ["Front", "Three-quarter", "Side"] : ["Three-quarter", "Side"]) {
        await page.getByRole("button", { name: view, exact: true }).click();
        for (let step = 0; step <= 8; step++) {
          await page.getByLabel("Scrub timeline", { exact: true }).fill(String(step * 600));
          await page.evaluate(async () => { await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); });
          await page.locator("canvas").screenshot({ path: `${artifacts}/${view.toLowerCase()}-${step}.png` });
        }
      }
      await page.getByRole("button", { name: "Three-quarter", exact: true }).click();
      await page.getByRole("button", { name: "Play", exact: true }).click();
      const first = Number(await page.getByLabel("Scrub timeline", { exact: true }).inputValue());
      await expect.poll(async () => Number(await page.getByLabel("Scrub timeline", { exact: true }).inputValue())).not.toBe(first);
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      await page.getByRole("button", { name: /^Start ·/ }).click();
      await page.getByLabel(`${machineTravelLabels[slug]} percent`, { exact: true }).fill("42");
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expect(page.getByText(/Saved at.*Private/)).toBeVisible();
      await page.reload(); await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible();
      await selectWorkshopObject(page, studioAssetNames[slug]);
      await openWorkshopTool(page, "Timeline");
      await expect(page.getByLabel(`${machineTravelLabels[slug]} percent`, { exact: true })).toHaveValue("42");
      if (slug === "lat-pulldown-machine") {
        await expect(page.getByLabel("Pulldown grip", { exact: true })).toHaveValue(grip);
        await openWorkshopTool(page, "Contacts");
        await page.getByLabel("Pulldown grip", { exact: true }).selectOption(grip === "supinated" ? "pronated" : "supinated");
        await page.getByRole("button", { name: "Save", exact: true }).click();
        await expect(page.getByText(/Saved at.*Private/)).toBeVisible();
        await page.reload();
        await selectWorkshopObject(page, studioAssetNames[slug]);
        await expect(page.getByLabel("Pulldown grip", { exact: true })).toHaveValue(grip === "supinated" ? "pronated" : "supinated");
        await page.getByLabel("Pulldown grip", { exact: true }).selectOption(grip);
      }
      await openWorkshopTool(page, "Contacts");
      await expect(page.getByRole("button", { name: "Stop using machine", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Stop using machine", exact: true }).click();
      await expect(page.getByRole("button", { name: "Use this machine", exact: true })).toBeVisible();
      await openWorkshopTool(page, "Contacts");
      await page.getByRole("button", { name: "Use this machine", exact: true }).click();
      await page.screenshot({ path: `${artifacts}/workshop.png`, fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.setViewportSize({ width: 1600, height: 1100 });
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expect(page.getByText(/Saved at.*Private/)).toBeVisible();
      const metadata = await owner.rpc("save_private_metadata", { p_private_id: created.data, p_patch: {
        name: `Machine fixture ${slug} ${grip}`, family: slug === "lat-pulldown-machine" ? "lat-pulldown" : "squat",
        muscles: [{ slug: slug === "lat-pulldown-machine" ? "latissimus-dorsi" : "quadriceps", role: "primary" }],
        joint_actions: [{ slug: slug === "lat-pulldown-machine" ? "shoulder-adduction" : "knee-extension", role: "primary" }],
      } });
      if (metadata.error) throw metadata.error;
      await page.goto(`/my-exercises/${created.data}/submit`);
      await expect(page.getByRole("button", { name: "Submit for review", exact: true })).toBeEnabled();
      await page.getByRole("button", { name: "Submit for review", exact: true }).click();
      await expect(page).toHaveURL(/\/submissions\/[0-9a-f-]+$/);
      const submissionId = page.url().split("/").at(-1)!;
      const snapshot = await owner.from("exercise_submissions").select("original_content_id").eq("id", submissionId).single();
      if (snapshot.error) throw snapshot.error;
      const frozen = await owner.from("exercise_scenes").select("studio_layout").eq("content_id", snapshot.data.original_content_id).single();
      if (frozen.error) throw frozen.error;
      expect(frozen.data.studio_layout).toEqual(expect.objectContaining({ objects: [expect.objectContaining({ slug, machineUse: true,
        ...(slug === "lat-pulldown-machine" ? { machineGrip: grip } : {}) })] }));
      expect(errors).toEqual([]);
    } finally { await admin.auth.admin.deleteUser(account.data.user.id); }
  });
}
