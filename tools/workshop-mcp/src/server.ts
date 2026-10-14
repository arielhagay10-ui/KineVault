import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Locator, Page } from "playwright";
import { z } from "zod";
import { snapshotSchema, WorkshopBrowser } from "./browser.js";
import { guide } from "./guide.js";

const browser = new WorkshopBrowser();
const server = new McpServer({ name: "kinevault-workshop-mcp", version: "0.1.0" }, { instructions: "Read workshop://guide. Use workshop_open, then snapshots and screenshots to try the real workshop. Edits autosave real private drafts." });
const roles = z.enum(["button", "link", "textbox", "spinbutton", "slider", "searchbox", "combobox", "checkbox", "tab", "radio", "region", "group"]);
const targetSchema = z.object({
  by: z.enum(["role", "label", "text"]),
  name: z.string().min(1).max(300).describe("Exact accessible name from the latest snapshot."),
  role: roles.optional().describe("Required with by=role."),
  region: z.string().min(1).max(300).optional().describe("Optional exact region name to scope duplicate controls."),
  index: z.number().int().min(0).max(100).optional().describe("Explicit zero-based index if names still repeat."),
}).strict();
type Target = z.infer<typeof targetSchema>;

function locate(page: Page, target: Target): Locator {
  const root = target.region ? page.getByRole("region", { name: target.region, exact: true }) : page.locator("body");
  if (target.by === "role" && !target.role) throw new Error("Supply target.role with by=role, using the latest snapshot.");
  const locator = target.by === "role" ? root.getByRole(target.role!, { name: target.name, exact: true })
    : target.by === "label" ? root.getByLabel(target.name, { exact: true }) : root.getByText(target.name, { exact: true });
  const visible = locator.filter({ visible: true });
  return target.index === undefined ? visible : visible.nth(target.index);
}

function json(data: Record<string, unknown>): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: data };
}

function guarded(operation: () => Promise<CallToolResult>): Promise<CallToolResult> {
  return browser.run(async () => {
    try { return await operation(); }
    catch (error) {
      const message = error instanceof Error ? error.message : "Unknown workshop error";
      return { isError: true, content: [{ type: "text", text: `${message.slice(0, 2000)}\nInspect workshop_snapshot for current names; workshop_open recovers navigation. For login run npm run login, then restart MCP.` }] };
    }
  });
}
const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const editing = { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false };

server.registerResource("workshop-guide", "workshop://guide", { title: "Workshop agent guide", mimeType: "text/plain" }, async uri => ({ contents: [{ uri: uri.href, mimeType: "text/plain", text: guide }] }));
server.registerPrompt("try-workshop", { title: "Try the workshop", description: "Explore the workshop in a fresh private draft and report verified findings." }, async () => ({ messages: [{ role: "user", content: { type: "text", text: guide } }] }));

server.registerTool("workshop_open", {
  title: "Open workshop", description: "Open a fresh private draft, or an explicitly requested existing draft UUID. Returns controls and preview readiness. Sign-in redirect means operator login is needed.",
  inputSchema: z.object({ draftId: z.uuid().optional() }).strict(), outputSchema: snapshotSchema, annotations: editing,
}, ({ draftId }) => guarded(async () => {
  const page = await browser.page();
  await page.goto(`${browser.config.origin}${draftId ? `/my-exercises/${draftId}/workshop` : "/my-exercises/new"}`, { waitUntil: "domcontentloaded" });
  await page.locator('[data-workshop="studio"], input[type="password"]').first().waitFor({ state: "visible", timeout: 30_000 });
  return json(await browser.snapshot());
}));

server.registerTool("workshop_snapshot", {
  title: "Inspect workshop", description: "Read visible accessible controls, URL, viewport, preview loading state and last 20 browser errors. Use exact names in control tools. Narrow to a named region if truncated.",
  inputSchema: z.object({ region: z.string().min(1).max(300).optional() }).strict(), outputSchema: snapshotSchema, annotations: readOnly,
}, ({ region }) => guarded(async () => json(await browser.snapshot(region))));

server.registerTool("workshop_control", {
  title: "Use a workshop control", description: "Interact through exact visible names from snapshot. Fill commits with blur. Select uses option label. Check uses checked boolean. Press uses a Playwright key such as Enter, Escape or Control+z. Returns updated controls.",
  inputSchema: z.object({ action: z.enum(["click", "fill", "select", "check", "press", "hover"]), target: targetSchema, value: z.string().max(2000).optional(), checked: z.boolean().optional() }).strict(),
  outputSchema: snapshotSchema, annotations: editing,
}, ({ action, target, value, checked }) => guarded(async () => {
  const page = await browser.page();
  browser.assertOrigin(page.url());
  const locator = locate(page, target);
  if (action === "click") {
    const href = await locator.getAttribute("href");
    if (href) browser.assertOrigin(new URL(href, page.url()).href);
    await locator.click();
  } else if (action === "hover") await locator.hover();
  else if (action === "check") {
    if (checked === undefined) throw new Error("check requires checked=true or checked=false.");
    await locator.setChecked(checked);
  } else {
    if (value === undefined) throw new Error(`${action} requires value.`);
    if (action === "fill") { await locator.fill(value); await locator.blur(); }
    else if (action === "select") await locator.selectOption({ label: value });
    else await locator.press(value);
  }
  return json(await browser.snapshot());
}));

server.registerTool("workshop_pointer", {
  title: "Use the 3D preview pointer", description: "Coordinates are viewport CSS pixels from screenshot. Click/double-click, drag with optional right button to orbit, or scroll at x/y. Drag requires endX/endY; scroll requires deltaY. Returns updated controls; screenshot afterward to inspect geometry.",
  inputSchema: z.object({ action: z.enum(["click", "double_click", "drag", "scroll"]), x: z.number().finite().min(0), y: z.number().finite().min(0), endX: z.number().finite().min(0).optional(), endY: z.number().finite().min(0).optional(), button: z.enum(["left", "right"]).default("left"), deltaY: z.number().finite().min(-3000).max(3000).optional() }).strict(),
  outputSchema: snapshotSchema, annotations: editing,
}, ({ action, x, y, endX, endY, button, deltaY }) => guarded(async () => {
  const page = await browser.page();
  browser.assertOrigin(page.url());
  const viewport = page.viewportSize()!;
  for (const point of [{ x, y }, ...(endX !== undefined && endY !== undefined ? [{ x: endX, y: endY }] : [])]) {
    if (point.x >= viewport.width || point.y >= viewport.height) throw new Error("Pointer coordinates are outside the viewport. Take a new screenshot.");
  }
  if (action === "drag") {
    if (endX === undefined || endY === undefined) throw new Error("drag requires endX and endY.");
    await page.mouse.move(x, y);
    try { await page.mouse.down({ button }); await page.mouse.move(endX, endY, { steps: 20 }); }
    finally { await page.mouse.up({ button }); }
  } else if (action === "scroll") {
    if (deltaY === undefined) throw new Error("scroll requires deltaY.");
    await page.mouse.move(x, y); await page.mouse.wheel(0, deltaY);
  } else if (action === "double_click") await page.mouse.dblclick(x, y, { button });
  else await page.mouse.click(x, y, { button });
  return json(await browser.snapshot());
}));

server.registerTool("workshop_screenshot", {
  title: "See the workshop", description: "Return a PNG image of the actual viewport and save an evidence file under ignored .local-artifacts. Use for 3D contacts, camera and gesture coordinates.",
  inputSchema: z.object({}).strict(), annotations: readOnly,
}, () => guarded(async () => {
  const { data, path } = await browser.screenshot();
  return { content: [{ type: "text", text: path }, { type: "image", mimeType: "image/png", data: data.toString("base64") }] };
}));

server.registerTool("workshop_wait", {
  title: "Wait for a control", description: "Wait up to 30 seconds for a named control to become visible or hidden, then inspect. Useful for save feedback and changing panels without blind sleeps.",
  inputSchema: z.object({ target: targetSchema, state: z.enum(["visible", "hidden"]).default("visible"), timeoutMs: z.number().int().min(1).max(30_000).default(10_000) }).strict(), outputSchema: snapshotSchema, annotations: readOnly,
}, ({ target, state, timeoutMs }) => guarded(async () => {
  const page = await browser.page(); browser.assertOrigin(page.url());
  await locate(page, target).waitFor({ state, timeout: timeoutMs });
  return json(await browser.snapshot());
}));

server.registerTool("workshop_reload", {
  title: "Reload saved workshop", description: "Reload the current app page to verify persistence. Wait for save confirmation first; unsaved changes can be lost.",
  inputSchema: z.object({}).strict(), outputSchema: snapshotSchema, annotations: editing,
}, () => guarded(async () => {
  const page = await browser.page(); browser.assertOrigin(page.url());
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator('[data-workshop="studio"], input[type="password"]').first().waitFor({ state: "visible", timeout: 30_000 });
  return json(await browser.snapshot());
}));

server.registerTool("workshop_close", {
  title: "Close workshop browser", description: "Release this agent's browser. Saved private drafts remain. Unsaved browser recovery is session-local. Open starts a fresh isolated context.",
  inputSchema: z.object({}).strict(), annotations: editing,
}, () => guarded(async () => { await browser.close(); return json({ closed: true }); }));

let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  const deadline = setTimeout(() => process.exit(1), 5000);
  deadline.unref();
  await browser.run(() => browser.close());
  await server.close();
  clearTimeout(deadline);
}
process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
process.stdin.once("end", () => void shutdown());
await server.connect(new StdioServerTransport());
