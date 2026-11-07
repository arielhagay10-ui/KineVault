import test from "node:test";
import assert from "node:assert/strict";
import { deliverMailpitEmail } from "./mailpit.mjs";

const payload = { from: "KineVault <updates@example.test>", to: ["owner@example.test"], subject: "Review update", text: "Update", html: "<p>Update</p>" };
const local = "http://127.0.0.1:15524";

test("local mail posts the frozen payload to loopback Mailpit and records its message ID", async () => {
  const calls = [];
  const result = await deliverMailpitEmail(payload, local, async (url, request) => { calls.push({ url: String(url), request }); return Response.json({ ID: "message-1" }); });
  assert.deepEqual(result, { success: true, providerId: "message-1" });
  assert.equal(calls[0].url, `${local}/api/v1/send`);
  assert.deepEqual(JSON.parse(calls[0].request.body), {
    From: { Email: "updates@example.test" }, To: [{ Email: "owner@example.test" }], Subject: "Review update", Text: "Update", HTML: "<p>Update</p>",
  });
});

test("local mail refuses non-loopback catchers before sending", async () => {
  for (const url of ["https://mail.example.com", "http://localhost.evil.test:8025", "http://user:pass@127.0.0.1:15524", `${local}/api`]) {
    await assert.rejects(deliverMailpitEmail(payload, url, async () => { throw new Error("sent"); }), /Local origin required/);
  }
});

test("local mail keeps the provider retry semantics", async () => {
  const status = code => async () => new Response(null, { status: code });
  assert.deepEqual(await deliverMailpitEmail(payload, local, status(503)), { success: false, errorCode: "provider_unavailable", retry: true });
  assert.deepEqual(await deliverMailpitEmail(payload, local, status(400)), { success: false, errorCode: "provider_rejected", retry: false });
  assert.deepEqual(await deliverMailpitEmail(payload, local, async () => Response.json({})), { success: false, errorCode: "provider_response_invalid", retry: true });
  assert.deepEqual(await deliverMailpitEmail(payload, local, async () => { throw new TypeError("refused"); }), { success: false, errorCode: "provider_unavailable", retry: true });
});
