import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { Euler, Quaternion } from "three";
import { blankWorkshopScene } from "../../src/lib/motion/workshop";
import { cleanupLocalFixture } from "../helpers/local-fixtures";
import { jointField, selectWorkshopJoint } from "./workshop-menu.helpers";

test.use({ launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader"] } });

test("a turned ankle stops at its rotation limit without sideways drift", async ({ page }) => {
  test.setTimeout(180_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["127.0.0.1", "localhost"].includes(new URL(url).hostname)) throw Error("Local fixtures required");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const owner = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  const email = `ankle-rings-${randomUUID()}@example.test`, password = `Ankle-${randomUUID()}!`;
  const account = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (account.error) throw account.error;
  const directory = ".local-artifacts/ankle-rings"; mkdirSync(directory, { recursive: true });
  try {
    await owner.auth.signInWithPassword({ email, password });
    const created = await owner.rpc("save_workshop_draft", { p_scene: structuredClone(blankWorkshopScene), p_name: "Ankle ring boundary regression" });
    if (created.error) throw created.error;
    await page.setViewportSize({ width: 1500, height: 1100 });
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email); await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click(); await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto(`/my-exercises/${created.data}/workshop`);
    await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    await selectWorkshopJoint(page, "Left ankle");
    await page.getByRole("button", { name: "Side", exact: true }).click();
    const canvas = page.locator("canvas");
    let stopped = false, moved = false;
    const original = new Quaternion().setFromEuler(new Euler(-20 * Math.PI / 180, 15 * Math.PI / 180, -10 * Math.PI / 180));
    for (const direction of [-1, 1]) {
      for (const [axis, value] of [["x", "20"], ["y", "15"], ["z", "10"]] as const) {
        await jointField(page, axis).fill(value); await jointField(page, axis).press("Enter");
      }
      const screenshot = await canvas.screenshot({ path: `${directory}/ring-before-${direction}.png` });
      const ring = await page.evaluate(async base64 => {
        const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob(base64), value => value.charCodeAt(0))], { type: "image/png" }));
        const context = new OffscreenCanvas(bitmap.width, bitmap.height).getContext("2d")!;
        context.drawImage(bitmap, 0, 0);
        const { data, width, height } = context.getImageData(0, 0, bitmap.width, bitmap.height);
        bitmap.close();
        let selected: { x: number; y: number; width: number; height: number } | undefined;
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
          const offset = (y * width + x) * 4;
          if (data[offset] > 170 && data[offset + 1] < 110 && data[offset + 2] < 110 && (!selected || x > selected.x)) selected = { x, y, width, height };
        }
        return selected;
      }, screenshot.toString("base64"));
      if (!ring) throw Error("No visible red ankle rotation ring");
      const bounds = (await canvas.boundingBox())!;
      const point = { x: bounds.x + ring.x * bounds.width / ring.width, y: bounds.y + ring.y * bounds.height / ring.height };
      await page.mouse.move(point.x, point.y); await page.mouse.down();
      await page.mouse.move(point.x, point.y + direction * 50, { steps: 12 }); await page.mouse.up();
      const values = { x: Number(await jointField(page, "x").inputValue()), y: Number(await jointField(page, "y").inputValue()), z: Number(await jointField(page, "z").inputValue()) };
      const delta = original.clone().invert().multiply(new Quaternion().setFromEuler(new Euler(-values.x * Math.PI / 180, values.y * Math.PI / 180, -values.z * Math.PI / 180)));
      stopped ||= Math.abs(delta.x) < .00001;
      moved ||= Math.abs(delta.x) > .005;
      expect(Math.abs(delta.y) + Math.abs(delta.z)).toBeLessThan(.015);
      expect(values.x).toBeLessThanOrEqual(20);
      await canvas.screenshot({ path: `${directory}/ring-after-${direction}.png` });
    }
    expect(stopped).toBe(true); expect(moved).toBe(true);
  } finally { await cleanupLocalFixture({ admin, owner, userId: account.data.user.id, email, password }); }
});
