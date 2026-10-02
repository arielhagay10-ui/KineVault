"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { Constants } from "@/lib/database.types";
import { parseReviewForm } from "@/lib/moderation/schema";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { motionAnnotationSchema } from "@/lib/motion/scene-schema";
import { resolveRenderReplacements } from "@/lib/media/render-replacements";

export type ReviewActionState = { error: string | null; message?: string; href?: string };

export async function editAnnotations(submissionId: string, annotations: unknown, comment: string): Promise<ReviewActionState> {
  await requireRole(["reviewer", "admin"]);
  const parsed = z.object({ id: z.uuid(), annotations: z.array(motionAnnotationSchema).max(24), comment: z.string().trim().min(5).max(2000) })
    .safeParse({ id: submissionId, annotations, comment });
  if (!parsed.success) return { error: "Check note timing and add a useful audit comment." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("edit_submission_annotations", { p_submission_id: parsed.data.id,
    p_annotations: parsed.data.annotations, p_comment: parsed.data.comment });
  if (error) return { error: reviewError(error) };
  refreshReview(parsed.data.id);
  return { error: null, message: "Movement notes saved in the review history." };
}

function refreshReview(id: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/submissions");
  revalidatePath(`/admin/submissions/${id}`);
  revalidatePath(`/submissions/${id}`);
  revalidatePath("/submissions");
  revalidatePath("/exercises");
}

function reviewError(error: { code?: string; message: string }) {
  if (error.code === "P0001") return error.message;
  if (error.code === "23505") return "That public slug or classification is already used. Choose another.";
  return "The review could not be saved. Reload and try again.";
}

export async function editSubmission(_previous: ReviewActionState, data: FormData): Promise<ReviewActionState> {
  await requireRole(["reviewer", "admin"]);
  const id = z.uuid().safeParse(data.get("submissionId"));
  const comment = z.string().trim().min(5).max(2000).safeParse(data.get("comment"));
  const parsed = parseReviewForm(data);
  if (!id.success || !comment.success || !parsed.success) {
    return { error: "Check the classifications and add an audit comment of at least five characters." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("edit_submission_classifications", {
    p_submission_id: id.data, p_patch: parsed.data, p_comment: comment.data,
  });
  if (error) return { error: reviewError(error) };
  refreshReview(id.data);
  return { error: null, message: "Corrections saved in the review history." };
}

const decisionSchema = z.object({
  submissionId: z.uuid(),
  decision: z.enum(["begin", "request_changes", "reject", "approve", "merge", "retry"]),
  reason: z.enum(Constants.public.Enums.moderation_reason).default("other"),
  comment: z.string().trim().max(2000).default(""),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120).nullable(),
  relation: z.enum(["new", "variation"]).default("new"),
  relatedId: z.uuid().nullable(),
  candidateId: z.uuid().nullable(),
}).superRefine((value, context) => {
  if (["request_changes", "reject", "merge"].includes(value.decision) && value.comment.length < 5) {
    context.addIssue({ code: "custom", path: ["comment"], message: "Add a useful review comment." });
  }
  if (value.decision === "approve" && (!value.slug || (value.relation === "variation" && !value.relatedId))) {
    context.addIssue({ code: "custom", path: ["slug"], message: "Choose a slug and complete the relationship." });
  }
  if (value.decision === "merge" && !value.relatedId) {
    context.addIssue({ code: "custom", path: ["relatedId"], message: "Choose the existing exercise to merge into." });
  }
});

export async function decideSubmission(_previous: ReviewActionState, data: FormData): Promise<ReviewActionState> {
  const identity = await requireRole(["reviewer", "admin"]);
  const optional = (name: string) => data.get(name) || null;
  const parsed = decisionSchema.safeParse({
    submissionId: data.get("submissionId"), decision: data.get("decision"),
    reason: data.get("reason") || "other", comment: data.get("comment") || "",
    slug: optional("slug"), relation: data.get("relation") || "new", relatedId: optional("relatedId"),
    candidateId: optional("candidateId"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your review decision." };
  const value = parsed.data;
  const supabase = await createClient();
  const { data: submission, error: loadError } = await supabase.from("exercise_submissions")
    .select("id,status,assigned_reviewer_id,original_content_id").eq("id", value.submissionId).maybeSingle();
  if (loadError || !submission || (submission.assigned_reviewer_id && submission.assigned_reviewer_id !== identity.userId && identity.role !== "admin")) {
    return { error: "This submission is unavailable or assigned to another reviewer." };
  }
  let error: { code?: string; message: string } | null = null;
  let href: string | undefined;
  switch (value.decision) {
    case "begin":
      ({ error } = await supabase.rpc("begin_submission_review", { p_submission_id: value.submissionId }));
      break;
    case "retry":
      ({ error } = await supabase.rpc("retry_submission_render", { p_submission_id: value.submissionId }));
      break;
    case "request_changes":
    case "reject":
      ({ error } = await supabase.rpc(value.decision === "reject" ? "reject_submission" : "request_submission_changes", {
        p_submission_id: value.submissionId, p_reason: value.reason, p_comment: value.comment,
      }));
      break;
    case "merge":
      ({ error } = await supabase.rpc("merge_submission", {
        p_submission_id: value.submissionId, p_exercise_id: value.relatedId!, p_comment: value.comment,
      }));
      break;
    case "approve": {
      if (submission.status !== "in_review") return { error: "Begin reviewing this submission before approving it." };
      const { data: assets, error: mediaError } = await supabase.from("exercise_media")
        .select("kind,storage_bucket,storage_path").eq("content_id", submission.original_content_id)
        .eq("storage_bucket", "exercise-private").in("kind", ["webm", "mp4", "poster"]);
      if (mediaError || new Set(assets?.map((item) => item.kind)).size !== 3) {
        return { error: "Wait for the complete demonstration render before approving." };
      }
      const admin = createAdminClient();
      for (const asset of await resolveRenderReplacements(assets ?? [])) {
        const extension = asset.kind === "poster" ? "webp" : asset.kind;
        const path = `submissions/${value.submissionId}/demo.${extension}`;
        const { error: copyError } = await admin.storage.from("exercise-private").copy(asset.storage_path, path, { destinationBucket: "exercise-public" });
        if (copyError) {
          // Publication can be retried after files were staged but the transaction failed.
          const { data: exists } = await admin.storage.from("exercise-public").exists(path);
          if (!exists) return { error: "The demonstration could not be prepared for publication. Try again." };
        }
      }
      ({ error } = await supabase.rpc("approve_submission", {
        p_submission_id: value.submissionId, p_slug: value.slug!, p_relation: value.relation,
        p_related_exercise_id: value.relation === "variation" ? value.relatedId! : undefined, p_comment: value.comment || undefined,
        p_candidate_exercise_id: value.candidateId ?? undefined,
      }));
      href = `/exercises/${value.slug}`;
      break;
    }
  }
  if (error) return { error: reviewError(error) };
  refreshReview(value.submissionId);
  return { error: null, message: "Review decision recorded.", href };
}
