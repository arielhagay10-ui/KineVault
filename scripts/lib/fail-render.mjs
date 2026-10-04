export async function failRenderClaim(supabase, job, uploaded) {
  // Completion may have committed even when its HTTP response was lost. The
  // failure RPC locks the claim and rejects a succeeded/expired generation.
  // Delete files only after it positively confirms that this claim failed.
  const { error } = await supabase.rpc("fail_render_job", {
    p_job_id: job.job_id, p_claim_id: job.claim_id, p_error_code: "render_error",
  });
  if (error) return error;
  if (!uploaded.length) return null;
  const { error: cleanupError } = await supabase.storage.from("exercise-private").remove(uploaded);
  return cleanupError;
}
