export const outcomeLabels = {
  request_changes: "Changes requested", approve: "Approved", reject: "Rejected", merge: "Merged",
} as const;
export type ReviewOutcome = keyof typeof outcomeLabels;

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export function buildReviewEmail(input: {
  action: ReviewOutcome; exerciseName: string; comment: string | null; submissionId: string; siteUrl: string;
}) {
  const origin = new URL(input.siteUrl);
  if (!["http:", "https:"].includes(origin.protocol)) throw new Error("Invalid site origin");
  const link = new URL(`/submissions/${input.submissionId}`, origin).href;
  const status = outcomeLabels[input.action];
  const subject = `KineVault: ${status.toLowerCase()}`;
  const heading = `${input.exerciseName}: ${status.toLowerCase()}`;
  const text = `${heading}\n\n${input.comment ? `Reviewer comment:\n${input.comment}\n\n` : ""}View your submission and review history:\n${link}\n\nKineVault`;
  const html = `<h1>${escapeHtml(heading)}</h1>${input.comment ? `<p><strong>Reviewer comment</strong></p><p style="white-space:pre-wrap">${escapeHtml(input.comment)}</p>` : ""}<p><a href="${escapeHtml(link)}">View your submission and review history</a></p><p>KineVault</p>`;
  return { subject, text, html };
}

export type EmailPayload = { from: string; to: string[]; subject: string; text: string; html: string };
export type EmailResult = { success: true; providerId: string } | {
  success: false; errorCode: "provider_unavailable" | "provider_rejected" | "provider_response_invalid"; retry: boolean;
};

export async function deliverResendEmail(payload: EmailPayload, apiKey: string, deliveryId: string, fetcher: typeof fetch = fetch): Promise<EmailResult> {
  try {
    const response = await fetcher("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `kinevault-review/${deliveryId}` },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return response.status >= 500 || [409, 429].includes(response.status)
      ? { success: false, errorCode: "provider_unavailable", retry: true }
      : { success: false, errorCode: "provider_rejected", retry: false };
    const result: unknown = await response.json();
    if (!result || typeof result !== "object" || !("id" in result) || typeof result.id !== "string" || !result.id || result.id.length > 200) {
      return { success: false, errorCode: "provider_response_invalid", retry: true };
    }
    return { success: true, providerId: result.id };
  } catch {
    return { success: false, errorCode: "provider_unavailable", retry: true };
  }
}
