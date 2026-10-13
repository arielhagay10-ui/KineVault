import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { cleanupLocalFixture } from "../helpers/local-fixtures";
import { blankWorkshopScene } from "../../src/lib/motion/workshop";

test("equipment edits stay collapsed and preserve roles through save and recovery", async ({ page }) => {
  test.setTimeout(90_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw new Error("Local fixtures required");
  const email = `equipment-details-${Date.now()}@example.test`, password = "EquipmentDetailsFixture2026!";
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const owner = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  const account = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (account.error) throw account.error;
  try {
    expect((await owner.auth.signInWithPassword({ email, password })).error).toBeNull();
    const draft = await owner.rpc("save_private_metadata", { p_patch: {
      name: "Collapsed equipment fixture", body_position: "supine",
      equipment: [{ slug: "cable", role: "optional" }, { slug: "dumbbell", role: "required" }],
    } });
    if (draft.error) throw draft.error;
    expect((await owner.rpc("save_private_scene", { p_private_id: draft.data!, p_scene: blankWorkshopScene })).error).toBeNull();
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto(`/my-exercises/${draft.data}/edit`);
    const classifications = page.getByText("Description, equipment and classifications (optional)", { exact: true });
    await classifications.click();
    const equipment = page.getByRole("group", { name: "Equipment", exact: true });
    const editEquipment = equipment.getByText("Edit equipment", { exact: true });
    await expect(editEquipment).toBeVisible();
    await expect(equipment.getByRole("searchbox")).not.toBeVisible();
    await expect(equipment.getByRole("checkbox")).toHaveCount(0);
    await expect(equipment.getByText("Cable", { exact: true }).first()).toBeVisible();
    await expect(equipment.getByText("Dumbbell", { exact: true }).first()).toBeVisible();
    const values = () => equipment.evaluate(element => {
      const data = new FormData(element.closest("form")!);
      return { equipment: data.getAll("equipment").sort(), cableRole: data.get("equipmentRole.cable"),
        dumbbellRole: data.get("equipmentRole.dumbbell"), barbellRole: data.get("equipmentRole.barbell") };
    });
    expect(await values()).toMatchObject({ equipment: ["cable", "dumbbell"], cableRole: "optional", dumbbellRole: "required" });
    await page.getByLabel("Name", { exact: true }).fill("Saved with equipment collapsed");
    await page.getByRole("button", { name: "Save privately", exact: true }).click();
    await expect(page).toHaveURL(/\?saved=1$/);
    await classifications.click();
    expect(await values()).toMatchObject({ equipment: ["cable", "dumbbell"], cableRole: "optional", dumbbellRole: "required" });
    await editEquipment.click();
    await expect(equipment.getByRole("searchbox")).toBeVisible();
    await equipment.getByLabel("Cable", { exact: true }).uncheck();
    await equipment.getByLabel("Dumbbell role", { exact: true }).selectOption("optional");
    await equipment.getByLabel("Barbell", { exact: true }).check();
    await equipment.getByRole("searchbox").fill("nothing-matches-123");
    await expect(equipment.getByLabel("Dumbbell", { exact: true })).toBeVisible();
    await equipment.getByLabel("Barbell role", { exact: true }).selectOption("optional");
    await editEquipment.click();
    await expect(equipment.getByRole("searchbox")).not.toBeVisible();
    expect(await values()).toMatchObject({ equipment: ["barbell", "dumbbell"], dumbbellRole: "optional", barbellRole: "optional" });
    page.on("dialog", dialog => dialog.accept());
    await page.reload();
    await page.getByRole("button", { name: "Restore details", exact: true }).click();
    await classifications.click();
    await expect(equipment.getByRole("searchbox")).not.toBeVisible();
    expect(await values()).toMatchObject({ equipment: ["barbell", "dumbbell"], dumbbellRole: "optional", barbellRole: "optional" });
    const position = page.getByLabel("Body position", { exact: true });
    await expect(position).toHaveValue("supine");
    await position.selectOption({ label: "Lying face up" });
    await position.selectOption({ label: "Lying face down" });
    await expect(position).toHaveValue("prone");
    await classifications.click();
    await page.getByRole("button", { name: "Save privately", exact: true }).click();
    await expect(page.getByText("Saved privately.", { exact: true })).toBeVisible();
    await classifications.click();
    await expect(position).toHaveValue("prone");
    expect(await values()).toMatchObject({ equipment: ["barbell", "dumbbell"], dumbbellRole: "optional", barbellRole: "optional" });
  } finally {
    await cleanupLocalFixture({ admin, userId: account.data.user.id, email, password, owner });
  }
});
