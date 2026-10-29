import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, type Page } from "@playwright/test";
import { PerspectiveCamera, Vector3 } from "three";
import { fitWorkshopCamera } from "../../src/lib/motion/workshop-camera";
import { test as base } from "./published-catalog.helpers";
import { cleanupLocalFixture } from "../helpers/local-fixtures";
import { createStudioObject } from "../../src/lib/motion/studio";
import { blankWorkshopScene, identityTransform, type StudioLayout, type WorkshopScene } from "../../src/lib/motion/workshop";
import { dismissWorkshopTutorial, expandWorkshopControls, openWorkshopTool, selectWorkshopJoint, selectWorkshopMoment, selectWorkshopObject } from "./workshop-menu.helpers";

const artifacts = ".local-artifacts/supports/e2e";
type SupportFixture = { owner: SupabaseClient; draftId: string; open: (scene: WorkshopScene) => Promise<void>; read: () => Promise<StudioLayout> };
const test = base.extend<{ supports: SupportFixture }>({
  supports: async ({ page, baseURL }, provide) => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    if (!["127.0.0.1", "localhost"].includes(new URL(url).hostname) || !baseURL || !["127.0.0.1", "localhost"].includes(new URL(baseURL).hostname)) throw Error("Local support fixtures required");
    const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const owner = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    const email = `supports-${randomUUID()}@example.test`, password = `Supports-${randomUUID()}!`;
    const account = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (account.error) throw account.error;
    try {
      const signedIn = await owner.auth.signInWithPassword({ email, password });
      if (signedIn.error) throw signedIn.error;
      const created = await owner.rpc("save_workshop_draft", { p_scene: structuredClone(blankWorkshopScene), p_name: "Support browser fixture" });
      if (created.error) throw created.error;
      const draftId = created.data as string;
      await page.setViewportSize({ width: 1440, height: 1050 });
      page.setDefaultTimeout(20_000);
      page.setDefaultNavigationTimeout(60_000);
      await page.goto("/sign-in");
      await page.getByLabel("Email", { exact: true }).fill(email);
      await page.getByLabel("Password", { exact: true }).fill(password);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(page).toHaveURL(/\/dashboard$/, { timeout: 60_000 });
      const open = async (scene?: WorkshopScene) => {
        if (scene) {
          const saved = await owner.rpc("save_private_scene", { p_private_id: draftId, p_scene: scene });
          if (saved.error) throw saved.error;
        }
        await page.goto(`/my-exercises/${draftId}/workshop`);
        await dismissWorkshopTutorial(page);
        await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
      };
      await open();
      mkdirSync(artifacts, { recursive: true });
      await provide({ owner, draftId, open, read: async () => {
        const draft = await owner.from("private_exercises").select("content_id").eq("id", draftId).single();
        if (draft.error) throw draft.error;
        const stored = await owner.from("exercise_scenes").select("studio_layout").eq("content_id", draft.data.content_id).single();
        if (stored.error) throw stored.error;
        return stored.data.studio_layout as StudioLayout;
      } });
    } finally {
      try { await page.close(); }
      finally { await cleanupLocalFixture({ admin, userId: account.data.user.id, email, password, owner }); }
    }
  },
});
test.use({ launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader"] } });
test.describe.configure({ timeout: 180_000 });

async function save(page: Page) {
  for (const moment of ["Start", "Finish", "Return"] as const) {
    await selectWorkshopMoment(page, moment);
    const capture = page.getByRole("button", { name: moment === "Start" ? "Capture start" : "Capture pose", exact: true });
    if (await capture.isVisible() && await capture.isEnabled()) await capture.click();
  }
  await page.getByRole("button", { name: "Save exercise", exact: true }).click();
  await expect(page.getByText(/Saved at.*Private/)).toBeVisible({ timeout: 30_000 });
}

test("Support on picks the human and preserves self bracing after reload", async ({ page, supports }) => {
  const scene = { ...structuredClone(blankWorkshopScene), studio: { body: { ...identityTransform }, objects: [] } };
  await supports.open(scene);
  await page.getByRole("button", { name: "Front", exact: true }).click();
  await openWorkshopTool(page, "Contacts");
  const support = page.getByRole("region", { name: "Body support", exact: true });
  await support.getByRole("combobox", { name: /^Body part/ }).selectOption("left-hand");
  await support.getByRole("button", { name: "Support on…", exact: true }).click();
  const canvas = page.locator("canvas");
  await canvas.scrollIntoViewIfNeeded();
  const orbitWithRightButton = async () => {
    const before = await canvas.screenshot(), box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + box.width * .75, box.y + box.height * .5);
    await page.mouse.down({ button: "right" });
    try { await page.mouse.move(box.x + box.width * .85, box.y + box.height * .55, { steps: 12 }); }
    finally { await page.mouse.up({ button: "right" }); }
    await expect.poll(async () => (await canvas.screenshot()).equals(before)).toBe(false);
  };
  await orbitWithRightButton();
  await page.getByRole("button", { name: "Front", exact: true }).click();
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const bounds = (await canvas.boundingBox())!;
  const fit = fitWorkshopCamera(scene, "front", bounds.width / bounds.height, 34);
  const camera = new PerspectiveCamera(34, bounds.width / bounds.height, .1, 100);
  camera.position.copy(fit.position); camera.lookAt(fit.target); camera.updateMatrixWorld();
  const point = new Vector3(.15, 1.45, .15).project(camera);
  await page.screenshot({ path: `${artifacts}/self-before-pick.png` });
  await page.mouse.click(bounds.x + (point.x + 1) * bounds.width / 2, bounds.y + (1 - point.y) * bounds.height / 2);
  await expect(support.getByText(/beyond reach|Select a valid support surface/)).toHaveCount(0);
  await expect(support.getByRole("button", { name: "Release", exact: true })).toBeVisible();
  await support.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(support.getByRole("button", { name: "Release", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(support.getByRole("button", { name: "Release", exact: true })).toBeVisible();
  await support.getByRole("button", { name: "Adjust position", exact: true }).click();
  await orbitWithRightButton();
  await support.getByText("Fine adjustment", { exact: true }).click();
  const coordinates = () => support.getByRole("textbox", { name: /^Support [XYZ] meters$/ }).evaluateAll(inputs => inputs.map(input => (input as HTMLInputElement).value));
  const beforeDrag = await coordinates(), handle = (await page.getByRole("button", { name: "Adjust support position", exact: true }).boundingBox())!;
  await page.mouse.move(handle.x + handle.width - 2, handle.y + handle.height / 2);
  await page.mouse.down();
  try { await page.mouse.move(handle.x + handle.width - 2, handle.y + handle.height / 2 + 6, { steps: 8 }); }
  finally { await page.mouse.up(); }
  await expect.poll(coordinates).not.toEqual(beforeDrag);
  await support.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await save(page);
  const stored = (await supports.read()).supports!;
  expect(stored[0].surface).toMatch(/^self:/);
  expect(stored[0].objectId).toBeNull();
  await page.reload(); await dismissWorkshopTutorial(page);
  await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
  await openWorkshopTool(page, "Contacts");
  await expect(support.getByRole("button", { name: "Release", exact: true })).toBeVisible();
  await expect(support.getByText(/beyond reach|Select a valid support surface/)).toHaveCount(0);
  expect((await supports.read()).supports).toEqual(stored);
  await page.screenshot({ path: `${artifacts}/self-bracing-reloaded.png` });
});

test("support controls stay contextual and floor setups preserve independent leg editing", async ({ page, supports }) => {
  test.setTimeout(180_000);
  const support = page.getByRole("region", { name: "Body support", exact: true });
  await expect(support).not.toBeVisible();
  await expect(page.getByRole("tab", { name: /support/i })).toHaveCount(0);
  await openWorkshopTool(page, "Contacts");
  await support.getByRole("combobox", { name: /^Body part/ }).selectOption("left-hand");
  await support.getByRole("button", { name: "Support on…", exact: true }).click();
  await expect(support.getByText(/Select a highlighted surface/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(support.getByText(/Select a highlighted surface/)).toHaveCount(0);
  await expect(support.getByRole("button", { name: "Release", exact: true })).toHaveCount(0);
  for (const [name, region] of [["Sit on floor", "pelvis"], ["Kneel on floor", "left-knee"], ["Lie face up", "back"], ["Lie face down", "chest"]]) {
    await openWorkshopTool(page, "Setups");
    await expandWorkshopControls(page, "Body support setups");
    await page.getByRole("button", { name, exact: true }).click();
    await openWorkshopTool(page, "Contacts");
    await support.getByRole("combobox", { name: /^Body part/ }).selectOption(region);
    await expect(support.getByRole("button", { name: "Release", exact: true })).toBeVisible();
  }
  await openWorkshopTool(page, "Setups");
  await expandWorkshopControls(page, "Body support setups");
  await page.getByRole("button", { name: "Sit on floor", exact: true }).click();
  await selectWorkshopJoint(page, "Left knee");
  const knee = page.getByRole("textbox", { name: "Bend Left knee degrees", exact: true });
  await expect(knee).toBeEnabled();
  await knee.fill("75"); await knee.press("Enter");
  await expect(knee).toHaveValue("75");
  await save(page);
  const saved = await supports.read();
  expect(saved.supports).toEqual([expect.objectContaining({ region: "pelvis", objectId: null, surface: "floor", point: expect.objectContaining({ y: 0 }), normal: { x: 0, y: 1, z: 0 } })]);
  await page.reload(); await dismissWorkshopTutorial(page);
  await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
  await openWorkshopTool(page, "Contacts");
  await support.getByRole("combobox", { name: /^Body part/ }).selectOption("pelvis");
  await expect(support.getByRole("button", { name: "Release", exact: true })).toBeVisible();
  await page.screenshot({ path: `${artifacts}/floor-saved.png` });
});

test("bench support adjustment, history, equipment movement, and release survive saving", async ({ page, supports }) => {
  test.setTimeout(180_000);
  const bench = { ...createStudioObject("bench", randomUUID(), 0), ...identityTransform, benchAngle: 0 };
  const contact = { region: "pelvis" as const, objectId: bench.id, surface: "seat", point: { x: 0, y: 0, z: .054 }, normal: { x: 0, y: 0, z: 1 }, turn: 0 };
  const scene = structuredClone(blankWorkshopScene);
  scene.keyframes = scene.keyframes.map(frame => ({ ...frame, poses: {
    "left-hip": { x: -90, y: 0, z: 0 }, "right-hip": { x: -90, y: 0, z: 0 },
    "left-knee": { x: -80, y: 0, z: 0 }, "right-knee": { x: -80, y: 0, z: 0 },
  } }));
  await supports.open({ ...scene, studio: { body: { ...identityTransform }, objects: [bench], supports: [contact] } });
  await openWorkshopTool(page, "Contacts");
  const support = page.getByRole("region", { name: "Body support", exact: true });
  await support.getByRole("combobox", { name: /^Body part/ }).selectOption("pelvis");
  await support.getByRole("button", { name: "Reposition body", exact: true }).click();
  await expect(support.getByRole("button", { name: "Use position", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Save exercise", exact: true }).click();
  await expect(page.getByText("Use position or cancel the preview before saving.", { exact: true })).toBeVisible();
  await page.keyboard.press("Control+z");
  await expect(support.getByRole("button", { name: "Use position", exact: true })).toHaveCount(0);
  await support.getByRole("button", { name: "Reposition body", exact: true }).click();
  await selectWorkshopObject(page, "Adjustable bench");
  await selectWorkshopObject(page, "Anatomical figure");
  await openWorkshopTool(page, "Contacts");
  await expect(support.getByRole("button", { name: "Use position", exact: true })).toHaveCount(0);
  await expandWorkshopControls(page, "Fine adjustment");
  const anchorX = support.getByRole("textbox", { name: "Support X meters", exact: true });
  await anchorX.fill("0.02"); await anchorX.press("Enter");
  await expect(anchorX).toHaveValue("0.02");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(anchorX).toHaveValue("0");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(anchorX).toHaveValue("0.02");
  await support.getByRole("button", { name: "Adjust position", exact: true }).click();
  const marker = page.getByRole("button", { name: "Adjust support position", exact: true });
  await expect(marker).toBeVisible();
  await marker.press("ArrowRight");
  await expect(anchorX).toHaveValue("0.03");
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const markerBox = await marker.boundingBox();
  if (!markerBox) throw Error("Support marker has no projected bounds");
  const center = { x: markerBox.x + markerBox.width / 2, y: markerBox.y + markerBox.height / 2 };
  await page.mouse.move(center.x, center.y); await page.mouse.down();
  await page.mouse.move(center.x + 4, center.y, { steps: 3 });
  await page.mouse.up();
  await expect(anchorX).not.toHaveValue("0.03");
  expect(Number(await anchorX.inputValue())).toBeGreaterThan(.03);
  expect(Number(await anchorX.inputValue()) - .03).toBeLessThan(.03);
  expect(Number(await support.getByRole("textbox", { name: "Support Y meters", exact: true }).inputValue())).toBeLessThan(.03);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(anchorX).toHaveValue("0.03");
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const cancelBox = await marker.boundingBox();
  if (!cancelBox) throw Error("Support marker has no projected bounds after undo");
  const cancelCenter = { x: cancelBox.x + cancelBox.width / 2, y: cancelBox.y + cancelBox.height / 2 };
  await page.mouse.move(cancelCenter.x, cancelCenter.y); await page.mouse.down();
  await page.mouse.move(cancelCenter.x + 4, cancelCenter.y, { steps: 3 });
  await page.keyboard.press("Escape"); await page.mouse.up();
  await expect(anchorX).toHaveValue("0.03");
  await support.getByRole("button", { name: "Done", exact: true }).click();
  await expect(support.getByRole("button", { name: "Done", exact: true })).toHaveCount(0);
  await selectWorkshopObject(page, "Adjustable bench");
  await openWorkshopTool(page, "Position");
  const benchX = page.getByRole("textbox", { name: "Position X meters", exact: true });
  await benchX.fill("0.1"); await benchX.press("Enter");
  await save(page);
  const saved = await supports.read();
  expect(saved.objects[0].x).toBe(.1);
  expect(saved.supports).toEqual([{ ...contact, point: { ...contact.point, x: .03 } }]);
  await page.reload(); await dismissWorkshopTutorial(page);
  await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
  await openWorkshopTool(page, "Contacts");
  await support.getByRole("combobox", { name: /^Body part/ }).selectOption("pelvis");
  await page.screenshot({ path: `${artifacts}/bench-before-release.png` });
  await support.getByRole("button", { name: "Release", exact: true }).click();
  await expect(support.getByRole("button", { name: "Release", exact: true })).toHaveCount(0);
  await page.screenshot({ path: `${artifacts}/bench-after-release.png` });
  await save(page);
  expect((await supports.read()).supports ?? []).toEqual([]);
});

test("chest bracing stays editable and anchored through playback and reload", async ({ page, supports }) => {
  const bench = { ...createStudioObject("bench", randomUUID(), 0), ...identityTransform, benchAngle: 60 };
  const contact = { region: "chest" as const, objectId: bench.id, surface: "pad", point: { x: 0, y: .8, z: .054 }, normal: { x: 0, y: 0, z: 1 }, turn: 0 };
  const scene = structuredClone(blankWorkshopScene);
  scene.keyframes = scene.keyframes.map((frame, index) => ({ ...frame, poses: {
    torso: { x: index === 1 ? 25 : -25, y: 0, z: 0 },
    "left-elbow": { x: index === 1 ? 90 : 20, y: 0, z: 0 },
    "right-ankle": { x: 20, y: -2, z: -12 },
  } }));
  await supports.open({ ...scene, studio: { body: { ...identityTransform }, objects: [bench], supports: [contact,
    { region: "right-hand", objectId: null, surface: "floor", point: { x: -5, y: 0, z: -7 }, normal: { x: 0, y: 1, z: 0 }, turn: 0 },
  ] } });
  await openWorkshopTool(page, "Contacts");
  const support = page.getByRole("region", { name: "Body support", exact: true });
  await support.getByRole("combobox", { name: /^Body part/ }).selectOption("right-hand");
  await support.getByRole("button", { name: "Release", exact: true }).click();
  await support.getByRole("combobox", { name: /^Body part/ }).selectOption("chest");
  await expandWorkshopControls(page, "Fine adjustment");
  const anchor = support.getByRole("textbox", { name: "Support Y meters", exact: true });
  await anchor.fill("0.85"); await anchor.press("Enter");
  await expect(anchor).toHaveValue("0.85");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(support.getByRole("alert")).toHaveCount(0);
  await save(page);
  expect((await supports.read()).supports).toEqual([{ ...contact, point: { ...contact.point, y: .85 } }]);
  await page.reload(); await dismissWorkshopTutorial(page);
  await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 60_000 });
  await openWorkshopTool(page, "Contacts");
  await support.getByRole("combobox", { name: /^Body part/ }).selectOption("chest");
  await expect(support.getByRole("button", { name: "Release", exact: true })).toBeVisible();
  await expandWorkshopControls(page, "Fine adjustment");
  await expect(anchor).toHaveValue("0.85");
  await page.screenshot({ path: `${artifacts}/chest-bracing-reloaded.png` });
});

