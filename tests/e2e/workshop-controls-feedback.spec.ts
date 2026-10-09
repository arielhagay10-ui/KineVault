import { cleanupLocalFixture } from "../helpers/local-fixtures";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { addWorkshopEquipment } from "../../src/lib/motion/workshop-freedom";
import { blankWorkshopScene } from "../../src/lib/motion/workshop";
import { cableAttachmentButton, expandWorkshopControls, openWorkshopMenu, openWorkshopRecovery, openWorkshopTool, selectWorkshopObject } from "./workshop-menu.helpers";

test.use({ launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader"] } });

test("exclusive menus, joint reset, right-drag camera and held cable placement survive saving", async ({ page }) => {
  test.setTimeout(180_000); page.setDefaultTimeout(15_000);
  page.setDefaultNavigationTimeout(60_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw Error("Local fixtures required");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const email = `controls-${randomUUID()}@example.test`, password = "WorkshopControls2026!";
  const account = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (account.error) throw account.error;

  try {
    const owner = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    await owner.auth.signInWithPassword({ email, password });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    const folder = ".local-artifacts/workshop/controls-feedback";
    mkdirSync(folder, { recursive: true });
    const scene = addWorkshopEquipment(structuredClone(blankWorkshopScene), "cable-machine", randomUUID());
    scene.keyframes = [0, 1600, 3200].map(timeMs => ({ timeMs, poses: {
      "left-elbow": { x: 70, y: 0, z: 0 }, "right-elbow": { x: 70, y: 0, z: 0 },
      "right-knee": { x: -40, y: 0, z: 0 }, torso: { x: 15, y: 0, z: 0 },
    } }));
    const cable = scene.studio!.objects[0];
    cable.attachment = "both"; cable.cableAttachment = "straight-bar";
    const created = await owner.rpc("save_workshop_draft", { p_scene: scene, p_name: "Cable controls fixture" });
    if (created.error) throw created.error;
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email); await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click(); await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto(`/my-exercises/${created.data}/workshop?metrics=1`);
    await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });

    const history = page.locator('details[name="workshop-dropdown"]').filter({ has: page.getByText("Edit history", { exact: true }).first() });
    await page.getByText("Edit history", { exact: true }).first().click();
    await expect(history).toHaveAttribute("open", "");
    await openWorkshopMenu(page);
    await expect(history).not.toHaveAttribute("open", "");
    await openWorkshopRecovery(page);
    await page.getByRole("button", { name: "Add equipment", exact: true }).click();
    await expect(page.locator('[data-workshop-menu]')).not.toHaveAttribute("open", "");
    await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
    await selectWorkshopObject(page, "Cable machine");
    await openWorkshopTool(page, "Position");
    await page.getByRole("button", { name: "Drag options", exact: true }).click();
    await expect(page.getByRole("button", { name: "Precise placement", exact: true })).toHaveAttribute("aria-expanded", "false");
    await expandWorkshopControls(page, "Precise placement");
    await expect(page.getByRole("button", { name: "Drag options", exact: true })).toHaveAttribute("aria-expanded", "false");

    await page.getByRole("button", { name: "Behind figure", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "Position Z meters", exact: true })).toHaveValue("-1.2");
    await page.getByRole("button", { name: "Turn tower right", exact: true }).click();
    const yaw = Number(await page.getByRole("textbox", { name: "Rotation Y degrees", exact: true }).inputValue());
    await page.getByRole("textbox", { name: "Rotation Y degrees", exact: true }).fill("45");
    await page.getByRole("textbox", { name: "Rotation Y degrees", exact: true }).press("Enter");
    expect(yaw).not.toBe(45);
    await openWorkshopTool(page, "Contacts");
    await expect(page.getByRole("button", { name: "Hold with both hands", exact: true })).toHaveAttribute("aria-pressed", "true");
    await cableAttachmentButton(page, "angled-bar").click();
    await page.locator("canvas").screenshot({ path: `${folder}/angled-bar.png` });
    await cableAttachmentButton(page, "lat-bar").click();
    await expect(page.getByLabel("Selected item")).toHaveAttribute("data-grip-reachable", "true");

    await page.getByRole("button", { name: "Move with mouse", exact: true }).click();
    const metrics = page.locator('[data-camera-position]');
    await expect(metrics).toHaveAttribute("data-camera-position", /\[/);
    const beforeCamera = await metrics.getAttribute("data-camera-position");
    const canvas = (await page.locator("canvas").boundingBox())!;
    await page.mouse.move(canvas.x + canvas.width * .45, canvas.y + canvas.height * .5);
    await page.mouse.down({ button: "right" });
    await page.mouse.move(canvas.x + canvas.width * .45 + 160, canvas.y + canvas.height * .5 + 30, { steps: 12 });
    await page.mouse.up({ button: "right" });
    await expect.poll(() => metrics.getAttribute("data-camera-position")).not.toBe(beforeCamera);
    await expect(page.getByRole("button", { name: "Move with mouse", exact: true })).toHaveAttribute("aria-pressed", "true");

    await openWorkshopTool(page, "Pose");
    await page.getByLabel("Body joint", { exact: true }).selectOption("left-elbow");
    const elbow = page.getByRole("textbox", { name: "Bend Left elbow degrees", exact: true });
    await expect(elbow).toHaveValue("70");
    await page.getByRole("button", { name: "Reset all joints", exact: true }).click();
    await expect(elbow).toHaveValue("0");
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(elbow).toHaveValue("70");
    await page.getByRole("button", { name: "Apply to all poses", exact: true }).click();
    await page.getByRole("button", { name: "Reset all joints", exact: true }).click();
    for (const index of ["0", "1", "2"]) {
      await page.getByLabel("Editing pose", { exact: true }).selectOption(index);
      await expect(elbow).toHaveValue("0");
    }
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText(/Saved at.*Private/)).toBeVisible();
    const saved = await owner.from("private_exercises").select("content_id").eq("id", created.data).single();
    const stored = await owner.from("exercise_scenes").select("id, studio_layout").eq("content_id", saved.data!.content_id).single();
    if (stored.error) throw stored.error;
    expect(stored.data.studio_layout).toMatchObject({ objects: [{ attachment: "both", cableAttachment: "lat-bar", z: -1.2, rotationY: 45 }] });
    const frames = await owner.from("motion_keyframes").select("position_ms, motion_joint_poses(rotation_x)").eq("scene_id", stored.data.id).order("position_ms");
    if (frames.error) throw frames.error;
    expect(frames.data).toEqual([0, 1600, 3200].map(position_ms => ({ position_ms, motion_joint_poses: [] })));
    await page.reload();
    await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
    await selectWorkshopObject(page, "Cable machine");
    await expect(cableAttachmentButton(page, "lat-bar")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByLabel("Selected item")).toHaveAttribute("data-grip-reachable", "true");
    for (let sample = 0; sample <= 16; sample++) {
      await page.getByLabel("Scrub timeline").evaluate((element, value) => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, String(value));
        element.dispatchEvent(new Event("input", { bubbles: true }));
      }, sample * 200);
      await expect(page.getByLabel("Selected item")).toHaveAttribute("data-grip-reachable", "true");
      await page.locator("canvas").screenshot({ path: `${folder}/wide-sample-${sample}.png` });
    }
    await page.getByRole("button", { name: "View start", exact: true }).click();
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect.poll(() => page.getByLabel("Scrub timeline").inputValue()).not.toBe("0");
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page.screenshot({ path: `${folder}/wide-grip-behind.png` });
    expect(errors).toEqual([]);
  } finally { await cleanupLocalFixture({ admin, userId: account.data.user.id, email, password }); }
});
