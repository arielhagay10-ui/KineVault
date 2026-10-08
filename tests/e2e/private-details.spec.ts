import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { cleanupLocalFixture } from "../helpers/local-fixtures";
import { blankWorkshopScene } from "../../src/lib/motion/workshop";

test("optional details keep selected metadata through search and collapse", async ({ page }) => {
  const email = `details-${Date.now()}@example.test`;
  const password = "ExamplePassphrase2026!";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw new Error("Local fixtures required");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const client = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signup = await client.auth.signUp({ email, password });
  expect(signup.error).toBeNull();
  if (!signup.data.user) throw new Error("Fixture account was not created");
  try {
  const draft = await client.rpc("save_private_metadata", { p_patch: {
    name: "Optional detail preservation", aliases: ["My original name"],
    muscles: [{ slug: "lateral-deltoid", role: "primary" }],
    joint_actions: [{ slug: "shoulder-abduction", role: "secondary" }],
    equipment: [{ slug: "cable", role: "optional" }], attachments: ["d-handle"],
    execution_instructions: "Keep my instructions.", resistance_profile: "unknown",
  } });
  expect(draft.error).toBeNull();
  const savedScene = await client.rpc("save_private_scene", { p_private_id: draft.data!, p_scene: blankWorkshopScene });
  expect(savedScene.error).toBeNull();
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto(`/my-exercises/${draft.data}/edit`);
  await expect(page.getByRole("group", { name: "Primary muscles", exact: true })).not.toBeVisible();
  await page.getByText("Anatomy (optional)", { exact: true }).click();
  const actions = page.getByRole("group", { name: "Joint actions", exact: true });
  const primary = page.getByRole("group", { name: "Primary muscles", exact: true });
  await expect(primary.getByLabel("Lateral Deltoid", { exact: true })).toBeChecked();
  await primary.getByRole("searchbox").fill("shoulders");
  await expect(primary.getByLabel("Lateral Deltoid", { exact: true })).toBeVisible();
  await actions.getByLabel("Shoulder Abduction role", { exact: true }).selectOption("stabilization");
  await actions.getByRole("searchbox").fill("nothing-matches-123");
  await expect(actions.getByRole("status")).toContainText("No match");
  await expect(actions.getByLabel("Shoulder Abduction", { exact: true })).toBeChecked();
  await page.getByText("Anatomy (optional)", { exact: true }).click();
  await page.getByRole("button", { name: "Save privately", exact: true }).click();
  await expect(page).toHaveURL(/\?saved=1$/);
  await page.getByText("Anatomy (optional)", { exact: true }).click();
  await expect(actions.getByLabel("Shoulder Abduction role", { exact: true })).toHaveValue("stabilization");
  await expect(primary.getByLabel("Lateral Deltoid", { exact: true })).toBeChecked();
  await page.getByText("Description, equipment and classifications (optional)", { exact: true }).click();
  await expect(page.getByRole("group", { name: "Equipment", exact: true }).getByLabel("Cable role", { exact: true })).toHaveValue("optional");
  await page.getByText("Instructions and detailed classifications (optional)", { exact: true }).click();
  await expect(page.getByLabel("Execution", { exact: true })).toHaveValue("Keep my instructions.");
  await expect(page.getByLabel("Aliases", { exact: true })).toHaveValue("My original name");
  await expect(page.getByRole("group", { name: "Attachments", exact: true }).getByLabel("D-Handle", { exact: true })).toBeChecked();
  } finally {
    await cleanupLocalFixture({ admin, userId: signup.data.user.id, email, password });
  }
});

test("library templates create an independent resumable private draft", async ({ page }) => {
  const email = `template-${Date.now()}@example.test`;
  const password = "ExamplePassphrase2026!";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw new Error("Local fixtures required");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const client = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signup = await client.auth.signUp({ email, password });
  expect(signup.error).toBeNull();
  if (!signup.data.user) throw new Error("Fixture account was not created");
  try {
  const source = await client.rpc("save_private_metadata", { p_patch: { name: "Reusable motion" } });
  expect(source.error).toBeNull();
  expect((await client.rpc("save_private_scene", { p_private_id: source.data!, p_scene: blankWorkshopScene })).error).toBeNull();
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/my-exercises");
  const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Reusable motion", exact: true }) });
  await card.getByRole("button", { name: "Preview saved motion", exact: true }).click();
  await expect(card.getByRole("button", { name: "Play", exact: true })).toBeVisible();
  await card.getByRole("button", { name: "Duplicate / use as template", exact: true }).click();
  await expect(page).toHaveURL(/\/my-exercises\/[0-9a-f-]+\/workshop$/);
  expect(page.url()).not.toContain(source.data!);
  await expect(page.getByRole("heading", { name: "Reusable motion (copy)", exact: true })).toBeVisible();
  const sourceContent = await client.from("private_exercises").select("exercise_content(name)").eq("id", source.data!).single();
  expect(sourceContent.data?.exercise_content).toMatchObject({ name: "Reusable motion" });
  } finally {
    await cleanupLocalFixture({ admin, userId: signup.data.user.id, email, password });
  }
});

