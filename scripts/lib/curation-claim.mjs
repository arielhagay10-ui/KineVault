export async function requireCurrentCurationClaim(service, item) {
  if (!item.job || !item.claimId) {
    throw new Error("Curation manifest has no saved claim identifier. Reconcile this job with the regular worker; do not adopt another attempt's claim.");
  }
  const { data: job, error } = await service.from("render_jobs")
    .select("status,claim_id,started_at").eq("id", item.job).maybeSingle();
  if (error) throw error;
  const startedAt = Date.parse(job?.started_at ?? "");
  if (job?.status !== "running" || job.claim_id !== item.claimId
    || !Number.isFinite(startedAt) || startedAt <= Date.now() - 600000) {
    throw new Error("Saved render claim is expired or no longer current. Reconcile this job with the regular worker.");
  }
}
