import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { buildReviewEmail, deliverResendEmail } from "../src/lib/notifications/email.ts";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const apiKey = process.env.RESEND_API_KEY;
const sender = process.env.NOTIFICATION_EMAIL_FROM;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
if (!url || !serviceKey || !apiKey || !sender || !siteUrl) throw new Error("Notification worker environment is incomplete");
if (new URL(siteUrl).protocol !== "https:" && !["localhost", "127.0.0.1"].includes(new URL(siteUrl).hostname)) throw new Error("Notification links require HTTPS");
const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

async function sendOne() {
  const { data, error } = await supabase.rpc("claim_notification_delivery");
  if (error) throw new Error("Could not claim notification delivery");
  const job = data?.[0];
  if (!job) return false;
  const email = buildReviewEmail({ action: job.action, exerciseName: job.exercise_name, comment: job.comment, submissionId: job.submission_id, siteUrl });
  const { data: prepared, error: prepareError } = await supabase.rpc("prepare_notification_delivery", {
    p_delivery_id: job.delivery_id, p_sender: sender, p_subject: email.subject, p_text: email.text, p_html: email.html,
  });
  const payload = prepared?.[0];
  if (prepareError || !payload?.recipient_email) throw new Error(`Could not prepare notification ${job.delivery_id}`);
  const result = await deliverResendEmail({ from: payload.sender, to: [payload.recipient_email], subject: payload.subject, text: payload.text_body, html: payload.html_body }, apiKey, job.delivery_id);
  const { error: finishError } = result.success
    ? await supabase.rpc("complete_notification_delivery", { p_delivery_id: job.delivery_id, p_provider_id: result.providerId })
    : await supabase.rpc("fail_notification_delivery", { p_delivery_id: job.delivery_id, p_error_code: result.errorCode, p_retry: result.retry });
  if (finishError) throw new Error(`Could not record notification result ${job.delivery_id}`);
  console.log(`Notification ${job.delivery_id}: ${result.success ? "accepted" : result.errorCode}`);
  return true;
}

let stopping = false;
process.on("SIGINT", () => { stopping = true; });
process.on("SIGTERM", () => { stopping = true; });
do {
  try {
    const sent = await sendOne();
    if (!process.argv.includes("--loop")) break;
    if (!sent) await new Promise((resolve) => setTimeout(resolve, 5000));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Notification worker failed");
    if (!process.argv.includes("--loop")) { process.exitCode = 1; break; }
    await new Promise((resolve) => setTimeout(resolve, 10000));
  }
} while (!stopping);
