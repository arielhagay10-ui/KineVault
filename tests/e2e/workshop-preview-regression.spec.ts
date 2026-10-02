import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

test.use({ launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader"] } });
test("recipe preview reaches ready and survives Strict Mode initialization", async ({ page }) => {
  test.setTimeout(120_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw Error("Local fixture required");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const email = `preview-regression-${Date.now()}@example.test`, password = "PrivateWorkshop2026!";
  const account = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (account.error) throw account.error;
  const logs: string[] = [];
  page.on("console", message => logs.push(`${message.type()}: ${message.text()}`));
  page.on("pageerror", error => logs.push(`pageerror: ${error.stack}`));
  page.on("response", response => { if (response.url().includes("/models/")) logs.push(`model-response: ${response.status()} ${response.url()}`); });
  page.on("requestfailed", request => { if (request.url().includes("/models/")) logs.push(`model-failure: ${request.failure()?.errorText}`); });
  const output = ".local-artifacts/workshop/simplification/browser";
  mkdirSync(output, { recursive: true });
  try {
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/my-exercises/new");
    await page.getByRole("button", { name: /Cable row.*Pull to the torso/ }).click();
    await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole("button", { name: "Fit scene", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Choose equipment", exact: true }).click();
    await page.getByRole("button", { name: /Pec deck/ }).filter({ visible: true }).first().click();
    await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 30000 });
    // Exercise the real graphics guard rather than the canvas's hidden HTML fallback.
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      Object.defineProperty(HTMLCanvasElement.prototype, "getContext", { configurable: true, value: function (this: HTMLCanvasElement, kind: string, ...args: unknown[]) {
        return kind === "webgl2" ? null : Reflect.apply(original, this, [kind, ...args]);
      } });
      window.addEventListener("restore-preview-graphics", () => Object.defineProperty(HTMLCanvasElement.prototype, "getContext", { configurable: true, value: original }));
    });
    await page.reload();
    await expect(page.locator('[data-anatomy-state="unsupported"]')).toBeVisible();
    await expect(page.getByText("3D preview needs WebGL.", { exact: true })).toBeVisible();
    await expect(page.getByText("Text scene summary", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Quick create", exact: true })).toBeEnabled();
    await page.evaluate(() => window.dispatchEvent(new Event("restore-preview-graphics")));
    await page.getByRole("button", { name: "Retry preview", exact: true }).click();
    await expect(page.locator('[data-anatomy-state="ready"]')).toBeVisible({ timeout: 30000 });
  } finally {
    logs.push(JSON.stringify(await page.locator("[data-anatomy-state]").evaluateAll(elements => elements.map(element => ({ state: element.getAttribute("data-anatomy-state"), highlightCount: element.getAttribute("data-highlight-count"), canvases: [...element.querySelectorAll("canvas")].map(canvas => ({ width: canvas.width, height: canvas.height, style: canvas.getAttribute("style") })) })))));
    writeFileSync(`${output}/preview-regression-console.txt`, logs.join("\n"));
    await page.screenshot({ path: `${output}/preview-regression.png` });
    await admin.auth.admin.deleteUser(account.data.user.id);
  }
});
