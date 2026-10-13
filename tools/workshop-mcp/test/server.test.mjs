import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const html = `<!doctype html><html><body>
<main data-workshop="studio"><h1>Workshop fixture</h1>
<label>Exercise name<input aria-label="Exercise name" onblur="localStorage.setItem('fixtureName',this.value)"></label>
<button onclick="document.querySelector('output').textContent=document.querySelector('input').value">Save privately</button>
<output aria-label="Saved name"></output>
<label>Equipment<select aria-label="Equipment"><option>Barbell</option><option>Dumbbell</option></select></label>
<button onclick="console.error('Fixture error')">Trigger error</button>
<a href="http://example.com/">Outside</a>
<a href="/redirect">Redirect outside</a>
<button onclick="window.open('OUTSIDE_URL')">Open popup</button>
<canvas width="300" height="200" style="position:absolute;left:20px;top:150px" data-anatomy-state="ready" aria-label="Preview"
 onpointerdown="this.dataset.drag='started'" onpointerup="this.dataset.drag='finished';document.querySelector('output').textContent='Dragged'"></canvas>
</main><script>document.querySelector('input').value=localStorage.getItem('fixtureName')||'';</script></body></html>`;
const http = createServer((req, res) => {
  if (req.url === "/redirect") { res.writeHead(302, { location: "/redirect-hop" }); res.end(); return; }
  if (req.url === "/redirect-hop") { res.writeHead(302, { location: outsideUrl }); res.end(); return; }
  res.setHeader("content-type", "text/html"); res.end(html.replaceAll("OUTSIDE_URL", outsideUrl));
});
let baseUrl;
const clients = [];
let outsideUrl;
let outsideHits = 0;
const outside = createServer((_req, res) => { outsideHits++; res.end("Outside origin"); });
before(async () => {
  await new Promise(resolve => outside.listen(0, "127.0.0.1", resolve));
  outsideUrl = `http://127.0.0.1:${outside.address().port}/`;
  await new Promise(resolve => http.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${http.address().port}`;
});
after(async () => {
  await Promise.all(clients.map(client => client.close()));
  await new Promise(resolve => http.close(resolve));
  await new Promise(resolve => outside.close(resolve));
});
async function connect() {
  const client = new Client({ name: "workshop-mcp-test", version: "1.0.0" });
  clients.push(client);
  await client.connect(new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL("../dist/server.js", import.meta.url))],
    env: { ...process.env, KV_WORKSHOP_URL: baseUrl, KV_WORKSHOP_HEADLESS: "1", KV_WORKSHOP_CHANNEL: process.platform === "win32" ? "chrome" : "", KV_WORKSHOP_AUTH: "", KV_WORKSHOP_ARTIFACTS: fileURLToPath(new URL("../../../.local-artifacts/workshop-mcp-tests", import.meta.url)) },
    stderr: "pipe",
  }));
  return client;
}
async function call(client, name, args = {}) { return client.callTool({ name, arguments: args }); }
function state(result) { assert.equal(result.isError, undefined, JSON.stringify(result.content)); return result.structuredContent; }

test("agents edit named controls, inspect screenshots, drag and keep separate sessions", { timeout: 60000 }, async () => {
  const a = await connect();
  assert.ok((await a.listTools()).tools.some(tool => tool.name === "workshop_pointer"));
  assert.ok((await a.readResource({ uri: "workshop://guide" })).contents[0].text.includes("Save privately"));
  let snapshot = state(await call(a, "workshop_open"));
  assert.equal(snapshot.url, `${baseUrl}/my-exercises/new`);
  assert.match(snapshot.controls, /Exercise name/);
  const edits = await Promise.all([
    call(a, "workshop_control", { action: "fill", target: { by: "label", name: "Exercise name" }, value: "Agent experiment" }),
    call(a, "workshop_control", { action: "click", target: { by: "role", role: "button", name: "Save privately" } }),
  ]);
  for (const result of edits) state(result);
  assert.match(state(await call(a, "workshop_snapshot")).controls, /Agent experiment/);
  assert.match(state(await call(a, "workshop_reload")).controls, /Agent experiment/);
  await call(a, "workshop_control", { action: "select", target: { by: "label", name: "Equipment" }, value: "Dumbbell" });
  const screenshot = await call(a, "workshop_screenshot");
  assert.ok(screenshot.content.some(item => item.type === "image" && item.mimeType === "image/png" && item.data.startsWith("iVBOR")));
  await call(a, "workshop_pointer", { action: "drag", x: 60, y: 180, endX: 90, endY: 190 });
  assert.match(state(await call(a, "workshop_snapshot")).controls, /Dragged/);
  await call(a, "workshop_control", { action: "click", target: { by: "role", role: "button", name: "Trigger error" } });
  assert.ok(state(await call(a, "workshop_snapshot")).errors.includes("Fixture error"));
  const b = await connect();
  assert.doesNotMatch(state(await call(b, "workshop_open")).controls, /Agent experiment/);
  await call(a, "workshop_close");
  assert.equal(state(await call(a, "workshop_open")).url, `${baseUrl}/my-exercises/new`);
});

test("rejects unsafe navigation, invalid gestures and unexpected tool arguments", { timeout: 60000 }, async () => {
  const client = await connect();
  assert.equal((await call(client, "workshop_open", { draftId: "../../admin" })).isError, true);
  state(await call(client, "workshop_open"));
  assert.equal((await call(client, "workshop_pointer", { action: "drag", x: 5, y: 5 })).isError, true);
  assert.equal((await call(client, "workshop_pointer", { action: "click", x: 9999, y: 10 })).isError, true);
  assert.equal((await call(client, "workshop_control", { action: "click", target: { by: "role", role: "link", name: "Outside" } })).isError, true);
  assert.equal((await call(client, "workshop_control", { action: "click", target: { by: "role", role: "link", name: "Redirect outside" } })).isError, true);
  assert.equal(outsideHits, 0, "redirect must be blocked before contacting another origin");
  state(await call(client, "workshop_open"));
  state(await call(client, "workshop_control", { action: "click", target: { by: "role", role: "button", name: "Open popup" } }));
  assert.equal(outsideHits, 0, "popup must be blocked before contacting another origin");
  assert.equal((await call(client, "workshop_snapshot", { unexpected: true })).isError, true);
});
