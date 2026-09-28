import { describe, expect, it } from "vitest";
import { buildReviewEmail, deliverResendEmail, type EmailPayload } from "./email";

describe("review notifications", () => {
  it("escapes contributor text and links to the account review", () => {
    const email = buildReviewEmail({ action: "request_changes", exerciseName: '<img src=x onerror="bad()">', comment: "<script>alert(1)</script>", submissionId: "example-id", siteUrl: "https://kinevault.example" });
    expect(email.html).not.toContain("<script>");
    expect(email.html).not.toContain("<img");
    expect(email.html).toContain("https://kinevault.example/submissions/example-id");
    expect(email.text).toContain("Reviewer comment:");
  });
  it("uses one stable provider idempotency key across retries", async () => {
    const calls: RequestInit[] = [];
    const fetcher: typeof fetch = async (_url, request) => { calls.push(request!); return Response.json({ id: "receipt-1" }); };
    const payload: EmailPayload = { from: "updates@example.test", to: ["owner@example.test"], subject: "Review update", text: "Update", html: "<p>Update</p>" };
    await deliverResendEmail(payload, "test-key", "delivery-1", fetcher);
    await deliverResendEmail(payload, "test-key", "delivery-1", fetcher);
    expect(calls[0].headers).toEqual(calls[1].headers);
    expect(calls[0].body).toBe(calls[1].body);
    expect(calls[0].headers).toHaveProperty("Idempotency-Key", "kinevault-review/delivery-1");
  });
  it("retries rate limits but stops permanent provider rejections", async () => {
    const payload: EmailPayload = { from: "updates@example.test", to: ["owner@example.test"], subject: "Review update", text: "Update", html: "<p>Update</p>" };
    expect(await deliverResendEmail(payload, "test-key", "delivery-1", async () => new Response(null, { status: 429 }))).toMatchObject({ success: false, retry: true });
    expect(await deliverResendEmail(payload, "test-key", "delivery-1", async () => new Response(null, { status: 422 }))).toMatchObject({ success: false, retry: false });
  });
});
