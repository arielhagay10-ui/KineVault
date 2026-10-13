import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type Page } from "playwright";
import { z } from "zod";

export function configuration(env = process.env) {
  const url = new URL(env.KV_WORKSHOP_URL || "http://127.0.0.1:3000");
  if (url.protocol !== "http:" || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("KV_WORKSHOP_URL must be a loopback HTTP origin, for example http://127.0.0.1:3000.");
  }
  const artifacts = resolve(env.KV_WORKSHOP_ARTIFACTS || fileURLToPath(new URL("../.local-artifacts/", import.meta.url)));
  return {
    origin: url.origin,
    artifacts,
    auth: env.KV_WORKSHOP_AUTH === "" ? undefined : resolve(env.KV_WORKSHOP_AUTH || `${artifacts}/auth.json`),
    channel: env.KV_WORKSHOP_CHANNEL || (process.platform === "win32" ? "chrome" : undefined),
    headless: env.KV_WORKSHOP_HEADLESS !== "0",
  };
}

export const snapshotSchema = z.object({
  url: z.string(),
  viewport: z.object({ width: z.number(), height: z.number() }),
  preview: z.string().nullable(),
  controls: z.string(),
  truncated: z.boolean(),
  errors: z.array(z.string()),
});

export class WorkshopBrowser {
  readonly config: ReturnType<typeof configuration>;
  private browser?: Browser;
  private currentPage?: Page;
  private pending: Promise<unknown> = Promise.resolve();
  private errors: string[] = [];

  constructor(config = configuration()) { this.config = config; }

  run<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.pending.then(operation);
    this.pending = next.catch(() => undefined);
    return next;
  }

  assertOrigin(url: string) {
    if (new URL(url).origin !== this.config.origin) throw new Error("Navigation outside the configured workshop origin is blocked. Use workshop_open to recover.");
  }

  async page(): Promise<Page> {
    if (this.currentPage && !this.currentPage.isClosed()) return this.currentPage;
    if (this.browser) await this.close();
    const browser = await chromium.launch({ headless: this.config.headless, channel: this.config.channel });
    this.browser = browser;
    try {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        storageState: this.config.auth && existsSync(this.config.auth) ? this.config.auth : undefined,
        serviceWorkers: "block",
      });
      // Catch popup requests before the popup event; their frame may not exist yet.
      await context.route("**/*", async route => {
        const request = route.request();
        let allowed = true;
        if (request.isNavigationRequest()) {
          try { allowed = new URL(request.url()).origin === this.config.origin && request.frame().page() === this.currentPage; }
          catch { allowed = false; }
        }
        if (allowed) await route.continue();
        else {
          this.remember("Blocked popup or navigation outside the configured workshop origin.");
          await route.abort("blockedbyclient");
        }
      });
      const page = await context.newPage();
      this.currentPage = page;
      // CDP intercepts every redirect hop; Playwright routes only see the first.
      const navigation = await context.newCDPSession(page);
      navigation.on("Fetch.requestPaused", event => {
        const allowed = new URL(event.request.url).origin === this.config.origin;
        if (!allowed) this.remember("Blocked navigation outside the configured workshop origin.");
        const resumed = allowed
          ? navigation.send("Fetch.continueRequest", { requestId: event.requestId })
          : navigation.send("Fetch.failRequest", { requestId: event.requestId, errorReason: "BlockedByClient" });
        void resumed.catch(error => { if (!page.isClosed()) this.remember(error instanceof Error ? error.message : "Navigation interception failed."); });
      });
      await navigation.send("Fetch.enable", { patterns: [{ resourceType: "Document", requestStage: "Request" }] });
      page.setDefaultTimeout(10_000);
      page.setDefaultNavigationTimeout(60_000);
      page.on("console", message => { if (message.type() === "error") this.remember(message.text()); });
      page.on("pageerror", error => this.remember(error.message));
      page.on("dialog", dialog => void dialog.dismiss().catch(() => undefined));
      page.on("popup", popup => void popup.close().catch(() => undefined));
      return page;
    } catch (error) {
      await this.close();
      throw error;
    }
  }

  private remember(message: string) {
    this.errors.push(message.slice(0, 1000));
    this.errors = this.errors.slice(-20);
  }

  async snapshot(region?: string): Promise<z.infer<typeof snapshotSchema>> {
    const page = await this.page();
    this.assertOrigin(page.url());
    const root = region ? page.getByRole("region", { name: region, exact: true }) : page.locator("body");
    const controls = await root.ariaSnapshot({ timeout: 10_000 });
    return {
      url: page.url(),
      viewport: page.viewportSize()!,
      preview: await page.locator("[data-anatomy-state]").first().getAttribute("data-anatomy-state", { timeout: 1000 }).catch(() => null),
      controls: controls.slice(0, 24_000),
      truncated: controls.length > 24_000,
      errors: [...this.errors],
    };
  }

  async screenshot() {
    const page = await this.page();
    this.assertOrigin(page.url());
    await mkdir(this.config.artifacts, { recursive: true });
    const path = resolve(this.config.artifacts, `workshop-${crypto.randomUUID()}.png`);
    const data = await page.screenshot({ path, type: "png" });
    return { path, data };
  }

  async close() {
    const browser = this.browser;
    this.browser = undefined;
    this.currentPage = undefined;
    this.errors = [];
    await browser?.close();
  }
}
