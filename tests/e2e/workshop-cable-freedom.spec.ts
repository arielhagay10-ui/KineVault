import { cleanupLocalFixture } from "../helpers/local-fixtures";
import { mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { createQuickScene } from "../../src/lib/motion/quick-create";
import { cableAttachmentSlugs } from "../../src/lib/motion/workshop";
import { cableAttachmentButton, jointField, selectWorkshopJoint, selectWorkshopObject, setWorkshopMode, openWorkshopTool } from "./workshop-menu.helpers";

test.use({ launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader"] } });

async function dragHandle(page: Page, dx: number, dy: number, cancel = false) {
  const handle = page.getByRole("button", { name: "Drag cable handle", exact: true });
  await handle.scrollIntoViewIfNeeded();
  const bounds = (await handle.boundingBox())!, x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height / 2;
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + dx, y + dy, { steps: 10 });
  if (cancel) await page.keyboard.press("Escape");
  await page.mouse.up();
}

test("row attachments, independent handle movement, free deadlift poses and saved playback", async ({ page }) => {
  test.setTimeout(180_000); page.setDefaultTimeout(15_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw Error("Local fixtures required");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const email = `row-handle-${Date.now()}@example.test`, password = "RowHandleFixture2026!";
  const account = await admin.auth.admin.createUser({ email, password, email_confirm: true }); if (account.error) throw account.error;

  try {
    const owner = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    await owner.auth.signInWithPassword({ email, password });
    const folder = ".local-artifacts/workshop/cable-freedom";
    mkdirSync(folder, { recursive: true });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    const fixture = createQuickScene("cable-row-machine");
    const created = await owner.rpc("save_workshop_draft", { p_scene: fixture, p_name: "Row cable freedom fixture" }); if (created.error) throw created.error;
    await page.setViewportSize({ width: 1500, height: 1100 });
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email); await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click(); await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto(`/my-exercises/${created.data}/workshop?metrics=1`);
    await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    await selectWorkshopObject(page, "Cable row");
    await openWorkshopTool(page, "Contacts");
    for (const kind of cableAttachmentSlugs) {
      const button = cableAttachmentButton(page, kind); await button.click(); await expect(button).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByRole("button", { name: "Leave machine", exact: true })).toBeVisible();
      await page.locator("canvas").screenshot({ path: `${folder}/seated-${kind}.png` });
    }
    await cableAttachmentButton(page, "straight-bar").click();
    await page.getByRole("button", { name: "Hold with both hands", exact: true }).click();
    await page.getByRole("button", { name: "Free body", exact: true }).click();
    await expect(page.getByRole("button", { name: "Leave machine", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Drag cable handle", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Front", exact: true }).click();
    await openWorkshopTool(page, "Position");
    const towerX = await page.getByRole("textbox", { name: "Position X meters", exact: true }).inputValue();
    await dragHandle(page, 0, -40);
    await expect(page.getByRole("textbox", { name: "Position X meters", exact: true })).toHaveValue(towerX);
    await selectWorkshopJoint(page, "Left elbow");
    const dragged = Number(await jointField(page, "x").inputValue()); expect(Math.abs(dragged)).toBeGreaterThan(1);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(jointField(page, "x")).toHaveValue("0");
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect(jointField(page, "x")).toHaveValue(String(dragged));
    await page.getByRole("button", { name: "Move with mouse", exact: true }).click();
    await dragHandle(page, 25, -15, true);
    await selectWorkshopJoint(page, "Left elbow");
    await expect(jointField(page, "x")).toHaveValue(String(dragged));
    await page.getByRole("combobox", { name: "Selected equipment", exact: true }).selectOption("body");
    await openWorkshopTool(page, "Position");
    await page.getByRole("textbox", { name: "Position X meters", exact: true }).fill("1.3");
    await page.getByRole("textbox", { name: "Position X meters", exact: true }).press("Enter");
    await expect(page.getByRole("textbox", { name: "Position X meters", exact: true })).toHaveValue("1.3");
    // A deadlift needs independently editable hips, knees, torso and feet.
    for (const [joint, value] of [["Left hip", "45"], ["Right hip", "45"], ["Left knee", "-25"], ["Right knee", "-25"], ["Torso", "30"]]) {
      await selectWorkshopJoint(page, joint); await jointField(page, "x").fill(value); await jointField(page, "x").press("Enter"); await expect(jointField(page, "x")).toHaveValue(value);
    }
    await page.getByRole("button", { name: "Pose hands and feet", exact: true }).click();
    await expect(page.getByRole("button", { name: /^Drag (Left|Right) (hand|foot)$/ })).toHaveCount(4);
    await expect(page.getByRole("button", { name: "Drag cable handle", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Move with mouse", exact: true }).click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved" }).first()).toBeVisible();
    const record = await owner.from("private_exercises").select("content_id").eq("id", created.data).single(); if (record.error) throw record.error;
    await expect.poll(async () => {
      const saved = await owner.from("exercise_scenes").select("studio_layout").eq("content_id", record.data.content_id).single(); if (saved.error) throw saved.error;
      return saved.data.studio_layout;
    }, { timeout: 20_000 }).toMatchObject({ body: { x: 1.3 }, objects: [{ slug: "cable-row-machine", machineUse: false, cableAttachment: "straight-bar", attachment: "both", x: fixture.studio!.objects[0].x }] });
    await page.reload(); await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible();
    await selectWorkshopJoint(page, "Left hip"); await expect(jointField(page, "x")).toHaveValue("45");
    await page.getByRole("button", { name: "Side", exact: true }).click();
    for (let step = 0; step <= 16; step++) {
      await page.getByLabel("Preview time", { exact: true }).fill(String(step * fixture.durationMs / 16));
      await page.evaluate(async () => { await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); });
      await page.locator("canvas").screenshot({ path: `${folder}/deadlift-${step}.png` });
    }
    await selectWorkshopObject(page, "Cable row");
    await openWorkshopTool(page, "Contacts");
    await page.getByRole("button", { name: "Free cable movement", exact: true }).click();
    await setWorkshopMode(page, "quick");
    await expect(page.getByRole("button", { name: "Drag cable handle", exact: true })).toBeVisible();
    await dragHandle(page, -10, -25);
    await openWorkshopTool(page, "Contacts");
    await cableAttachmentButton(page, "lat-bar").click();
    await page.getByRole("button", { name: "Front", exact: true }).click();
    await openWorkshopTool(page, "Position");
    const fixedX = await page.getByRole("textbox", { name: "Position X meters", exact: true }).inputValue();
    const grab = (await page.getByRole("button", { name: "Drag cable handle", exact: true }).boundingBox())!;
    const shaftX = grab.x + grab.width / 2 + 50, shaftY = grab.y + grab.height / 2;
    await page.mouse.move(shaftX, shaftY); await page.mouse.down(); await page.mouse.move(shaftX, shaftY - 35, { steps: 10 }); await page.mouse.up();
    await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeEnabled();
    await expect(page.getByRole("textbox", { name: "Position X meters", exact: true })).toHaveValue(fixedX);
    await selectWorkshopJoint(page, "Left elbow"); expect(Math.abs(Number(await jointField(page, "x").inputValue()))).toBeGreaterThan(1);
    await selectWorkshopObject(page, "Cable machine");
    await cableAttachmentButton(page, "rope").click(); await page.getByRole("button", { name: "Move with mouse", exact: true }).click();
    await dragHandle(page, 0, -20);
    await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeEnabled();
    expect(errors).toEqual([]);
  } finally {
    try {
      await page.close();
    } finally {
      await cleanupLocalFixture({ admin, userId: account.data.user.id, email, password });
    }
  }
});
