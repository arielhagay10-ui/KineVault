import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { createQuickScene } from "../../src/lib/motion/quick-create";
import type { StudioLayout, StudioObject } from "../../src/lib/motion/workshop";
import { cleanupLocalFixture } from "../helpers/local-fixtures";
import { dismissWorkshopTutorial, jointField, openWorkshopTool, selectWorkshopJoint, selectWorkshopMoment, selectWorkshopObject } from "./workshop-menu.helpers";

test.use({ viewport: { width: 1440, height: 1100 }, launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader"] } });

const evidence = ".local-artifacts/seating-quality";
type StoredPose = { rotation_x: number; rotation_y: number; rotation_z: number; rotation_w: number; rig_joints: { slug: string } | { slug: string }[] };
type StoredFrame = { position_ms: number; motion_joint_poses: StoredPose[] };
const jointName = (pose: StoredPose) => [pose.rig_joints].flat()[0].slug;
const withoutTorso = (frame: StoredFrame) => frame.motion_joint_poses.filter(pose => jointName(pose) !== "torso").sort((a, b) => jointName(a).localeCompare(jointName(b)));
const objectFrame = (object: StudioObject, timeMs: number) => object.frames?.find(frame => frame.timeMs === timeMs) ?? object;
const seatControls = (page: Page) => page.getByRole("region", { name: "Seated position", exact: true }).filter({ visible: true });

async function enterNumber(field: Locator, value: number) {
  await field.fill(String(value));
  await field.press("Enter");
}

async function inspectNormalUse(page: Page, name: string) {
  const playback = page.getByRole("region", { name: "Playback controls", exact: true });
  const slider = playback.getByRole("slider", { name: "Preview time", exact: true });
  const duration = Number(await slider.getAttribute("max"));
  await slider.press("Home");
  await playback.getByRole("button", { name: "Play", exact: true }).click();
  await expect.poll(async () => Number(await slider.inputValue()), { intervals: [100], timeout: 15_000 }).toBeGreaterThan(duration * .8);
  await expect.poll(async () => Number(await slider.inputValue()), { intervals: [100], timeout: 15_000 }).toBeLessThan(duration * .25);
  await playback.getByRole("button", { name: "Pause", exact: true }).click();
  for (const view of ["Three-quarter", "Side"]) {
    await page.getByRole("button", { name: view, exact: true }).click();
    for (let sample = 0; sample <= 8; sample++) {
      const box = (await slider.boundingBox())!;
      await page.mouse.click(box.x + 8 + (box.width - 16) * sample / 8, box.y + box.height / 2);
      await page.getByRole("group", { name: "3D exercise preview", exact: true }).screenshot({ path: `${evidence}/${name}-${view}-${sample}.png` });
    }
  }
  await page.getByRole("button", { name: "Three-quarter", exact: true }).click();
  await selectWorkshopMoment(page, "Start");
}

async function storedScene(owner: SupabaseClient, privateId: string) {
  const draft = await owner.from("private_exercises").select("content_id").eq("id", privateId).single();
  if (draft.error) throw draft.error;
  const scene = await owner.from("exercise_scenes").select("id,studio_layout").eq("content_id", draft.data.content_id).single();
  if (scene.error) throw scene.error;
  const frames = await owner.from("motion_keyframes").select("position_ms,motion_joint_poses(rotation_x,rotation_y,rotation_z,rotation_w,rig_joints(slug))")
    .eq("scene_id", scene.data.id).order("position_ms");
  if (frames.error) throw frames.error;
  return { layout: scene.data.studio_layout as unknown as StudioLayout, frames: frames.data as unknown as StoredFrame[] };
}

async function saveScene(page: Page) {
  const path = new URL(page.url()).pathname;
  await Promise.all([
    page.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).pathname === path),
    page.getByRole("button", { name: "Save exercise", exact: true }).click(),
  ]);
  await expect(page.getByRole("button", { name: "Save exercise", exact: true })).toHaveAttribute("aria-busy", "false");
  await expect(page.getByText(/Saved at.*Private/)).toBeVisible();
}

for (const slug of ["shoulder-press-machine", "bench", "leg-press"] as const) {
  test(slug === "leg-press" ? "leg-press plays its calibrated stroke with required sled contacts" : `${slug} keeps current-pose seating edits, free legs and saved settings through Reset seat`, async ({ page }) => {
    test.setTimeout(240_000);
    page.setDefaultTimeout(60_000);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    if (!["127.0.0.1", "localhost"].includes(new URL(url).hostname)) throw Error("Local fixtures required");
    const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const owner = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    const email = `seating-${randomUUID()}@example.test`, password = "SeatingFixture2026!";
    const account = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (account.error) throw account.error;
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    mkdirSync(evidence, { recursive: true });
    try {
      const signedIn = await owner.auth.signInWithPassword({ email, password });
      if (signedIn.error) throw signedIn.error;
      const scene = createQuickScene(slug), object = scene.studio!.objects[0];
      if (slug === "bench") scene.studio!.seating = { benchId: object.id, facing: "front" };
      const finishTime = scene.durationMs / 2;
      const created = await owner.rpc("create_workshop_exercise", { p_scene: scene });
      if (created.error) throw created.error;
      await page.goto("/sign-in");
      await page.getByLabel("Email", { exact: true }).fill(email);
      await page.getByLabel("Password", { exact: true }).fill(password);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(page).toHaveURL(/\/dashboard$/);
      await page.goto(`/my-exercises/${created.data}/workshop`);
      await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible();
      await expect(page.locator('[data-equipment-state="ready"]')).toBeVisible();
      await dismissWorkshopTutorial(page);
      const label = slug === "bench" ? "Adjustable bench" : slug === "leg-press" ? "Leg press" : "Shoulder press";
      await selectWorkshopObject(page, label);
      await openWorkshopTool(page, "Contacts");
      const controls = seatControls(page);
      await expect(controls).toBeVisible();
      if (slug === "leg-press") {
        await expect(controls.getByText("Feet stay attached to the sled. Change sled travel to move the legs.", { exact: true })).toBeVisible();
        await inspectNormalUse(page, "leg-press");
        await saveScene(page);
        await page.reload();
        await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible();
        await expect(page.locator('[data-equipment-state="ready"]')).toBeVisible();
        await inspectNormalUse(page, "leg-press-reloaded");
        expect(errors).toEqual([]);
        return;
      }
      await expect(controls.getByRole("checkbox", { name: "Automatic foot support", exact: true })).toBeChecked();
      if (slug === "shoulder-press-machine") {
        const grip = page.getByLabel("Press grip", { exact: true });
        await expect(grip).toHaveValue("wide");
        for (const value of ["wide", "neutral"]) {
          await grip.selectOption(value);
          await expect(grip).toHaveValue(value);
          await page.screenshot({ path: `${evidence}/press-${value}.png` });
          await inspectNormalUse(page, `press-${value}`);
        }
        await expect(page.getByRole("button", { name: "Stop using machine", exact: true })).toBeVisible();
      } else {
        const bench = page.getByRole("region", { name: "Bench body position", exact: true }).filter({ visible: true });
        await expect(bench.getByRole("button", { name: "Sit", exact: true })).toHaveAttribute("aria-pressed", "true");
      }

      // A second authored pose makes an accidental whole-animation reset observable.
      await selectWorkshopMoment(page, "Start");
      if (slug === "shoulder-press-machine") {
        await enterNumber(page.getByLabel("Left press travel percent", { exact: true }), 20);
        await enterNumber(page.getByLabel("Right press travel percent", { exact: true }), 20);
      }
      await enterNumber(controls.getByLabel("Seat left/right centimeters", { exact: true }), .5);
      await enterNumber(controls.getByLabel("Torso forward/back lean degrees", { exact: true }), 2);
      expect(Number(await controls.getByLabel("Seat left/right centimeters", { exact: true }).inputValue())).toBeGreaterThan(0);
      expect(Number(await controls.getByLabel("Torso forward/back lean degrees", { exact: true }).inputValue())).toBeGreaterThan(0);

      await selectWorkshopMoment(page, "Finish");
      if (slug === "shoulder-press-machine") {
        await enterNumber(page.getByLabel("Left press travel percent", { exact: true }), 45);
        await enterNumber(page.getByLabel("Right press travel percent", { exact: true }), 60);
      }
      await enterNumber(controls.getByLabel("Seat forward/back centimeters", { exact: true }), 1);
      await enterNumber(controls.getByLabel("Seat left/right centimeters", { exact: true }), -.5);
      await enterNumber(controls.getByLabel("Torso forward/back lean degrees", { exact: true }), 2);
      expect(Number(await controls.getByLabel("Seat forward/back centimeters", { exact: true }).inputValue())).toBeGreaterThan(0);
      expect(Number(await controls.getByLabel("Seat left/right centimeters", { exact: true }).inputValue())).toBeLessThan(0);
      expect(Number(await controls.getByLabel("Torso forward/back lean degrees", { exact: true }).inputValue())).toBeGreaterThan(0);

      await selectWorkshopJoint(page, "Right knee");
      const rightKnee = Number(await jointField(page, "x").inputValue());
      await selectWorkshopJoint(page, "Left knee");
      await expect(jointField(page, "x")).toBeEnabled();
      await enterNumber(jointField(page, "x"), 120);
      await expect(jointField(page, "x")).toHaveValue("120");
      await expect(jointField(page, "x")).toHaveAttribute("aria-invalid", "false");
      await selectWorkshopJoint(page, "Right knee");
      await expect.poll(async () => Number(await jointField(page, "x").inputValue())).toBeCloseTo(rightKnee, 5);
      await selectWorkshopObject(page, slug === "bench" ? "Adjustable bench" : "Shoulder press");
      await openWorkshopTool(page, "Contacts");
      await expect(controls.getByRole("checkbox", { name: "Automatic foot support", exact: true })).not.toBeChecked();
      if (slug === "shoulder-press-machine") await expect(page.getByRole("button", { name: "Stop using machine", exact: true })).toBeVisible();
      await page.screenshot({ path: `${evidence}/${slug}-before-reset.png` });
      await saveScene(page);
      const before = await storedScene(owner, created.data);
      const beforeObject = before.layout.objects.find(item => item.id === object.id)!;
      expect(beforeObject.seatFootSupport).toBe(false);
      expect(objectFrame(beforeObject, finishTime).seatOffsetZ).toBeGreaterThan(0);
      expect(objectFrame(beforeObject, 0).seatOffsetX).toBeGreaterThan(0);

      await controls.getByRole("button", { name: "Reset seat", exact: true }).click();
      for (const label of ["Seat forward/back centimeters", "Seat left/right centimeters", "Torso forward/back lean degrees", "Torso turn degrees", "Torso side lean degrees"]) {
        await expect(controls.getByLabel(label, { exact: true })).toHaveValue("0");
      }
      await expect(controls.getByRole("checkbox", { name: "Automatic foot support", exact: true })).not.toBeChecked();
      await saveScene(page);
      const after = await storedScene(owner, created.data);
      const afterObject = after.layout.objects.find(item => item.id === object.id)!;
      expect(objectFrame(afterObject, finishTime)).toMatchObject({ seatOffsetX: 0, seatOffsetZ: 0 });
      expect(afterObject.frames?.filter(frame => frame.timeMs !== finishTime)).toEqual(beforeObject.frames?.filter(frame => frame.timeMs !== finishTime));
      expect(afterObject).toMatchObject({ seatFootSupport: false });
      if (slug === "shoulder-press-machine") {
        expect(afterObject).toMatchObject({ machineUse: true, pressGrip: "neutral" });
        const previous = objectFrame(beforeObject, finishTime), current = objectFrame(afterObject, finishTime);
        expect(current.machinePositionLeft).toBe(previous.machinePositionLeft);
        expect(current.machinePositionRight).toBe(previous.machinePositionRight);
        expect(current.machinePositionLeft).not.toBe(current.machinePositionRight);
      } else expect(after.layout.seating).toEqual({ benchId: object.id, facing: "front" });
      for (const frame of after.frames) {
        const previous = before.frames.find(item => item.position_ms === frame.position_ms)!;
        expect(withoutTorso(frame)).toEqual(withoutTorso(previous));
        const torso = frame.motion_joint_poses.find(pose => jointName(pose) === "torso");
        if (frame.position_ms === finishTime) {
          if (torso) expect(torso).toMatchObject({ rotation_x: 0, rotation_y: 0, rotation_z: 0, rotation_w: 1 });
        } else expect(torso).toEqual(previous.motion_joint_poses.find(pose => jointName(pose) === "torso"));
      }

      await page.reload();
      await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible();
      await expect(page.locator('[data-equipment-state="ready"]')).toBeVisible();
      await dismissWorkshopTutorial(page);
      await selectWorkshopObject(page, slug === "bench" ? "Adjustable bench" : "Shoulder press");
      await selectWorkshopMoment(page, "Finish");
      await openWorkshopTool(page, "Contacts");
      await expect(controls.getByLabel("Seat forward/back centimeters", { exact: true })).toHaveValue("0");
      await expect(controls.getByLabel("Torso forward/back lean degrees", { exact: true })).toHaveValue("0");
      await expect(controls.getByRole("checkbox", { name: "Automatic foot support", exact: true })).not.toBeChecked();
      if (slug === "shoulder-press-machine") {
        await expect(page.getByLabel("Press grip", { exact: true })).toHaveValue("neutral");
        await expect(page.getByLabel("Left press travel percent", { exact: true })).toHaveValue(String(Math.round(objectFrame(afterObject, finishTime).machinePositionLeft! * 100)));
        await expect(page.getByLabel("Right press travel percent", { exact: true })).toHaveValue(String(Math.round(objectFrame(afterObject, finishTime).machinePositionRight! * 100)));
        await expect(page.getByRole("button", { name: "Stop using machine", exact: true })).toBeVisible();
      }
      await page.screenshot({ path: `${evidence}/${slug}-reloaded.png` });
      await selectWorkshopJoint(page, "Left knee");
      await expect(jointField(page, "x")).toHaveValue("120");
      await selectWorkshopMoment(page, "Start");
      await selectWorkshopObject(page, slug === "bench" ? "Adjustable bench" : "Shoulder press");
      await openWorkshopTool(page, "Contacts");
      expect(Number(await controls.getByLabel("Seat left/right centimeters", { exact: true }).inputValue())).toBeGreaterThan(0);
      expect(Number(await controls.getByLabel("Torso forward/back lean degrees", { exact: true }).inputValue())).toBeGreaterThan(0);
      expect(errors).toEqual([]);
    } finally {
      await cleanupLocalFixture({ admin, userId: account.data.user.id, email, password });
    }
  });
}
