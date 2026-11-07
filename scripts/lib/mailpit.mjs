import { localOrigin } from "./operations-validation.mjs";

// Local rehearsals only: loopback Mailpit send API, with the same result codes as Resend delivery.
export async function deliverMailpitEmail(payload, mailpitUrl, fetcher = fetch) {
  const endpoint = new URL("/api/v1/send", localOrigin(mailpitUrl));
  try {
    const response = await fetcher(endpoint, {
      method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ From: { Email: payload.from.match(/<([^>]+)>/)?.[1] ?? payload.from },
        To: payload.to.map(Email => ({ Email })), Subject: payload.subject, Text: payload.text, HTML: payload.html }),
    });
    if (!response.ok) return response.status >= 500
      ? { success: false, errorCode: "provider_unavailable", retry: true }
      : { success: false, errorCode: "provider_rejected", retry: false };
    const result = await response.json();
    return typeof result?.ID === "string" && result.ID && result.ID.length <= 200
      ? { success: true, providerId: result.ID }
      : { success: false, errorCode: "provider_response_invalid", retry: true };
  } catch {
    return { success: false, errorCode: "provider_unavailable", retry: true };
  }
}
