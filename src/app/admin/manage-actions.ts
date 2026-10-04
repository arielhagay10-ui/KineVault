"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { TAXONOMY_CACHE_TAG } from "@/lib/taxonomy-options";
import { requireRole } from "@/lib/auth";
import { Constants } from "@/lib/database.types";
import { taxonomyMutationSchema, taxonomyNameSchema } from "@/lib/moderation/taxonomies";
import { createClient } from "@/lib/supabase/server";

export type AdminActionState = { error: string | null; message?: string };

function mutationError(error: { code?: string; message: string }) {
  if (error.code === "P0001") return error.message;
  if (error.code === "23503") return "This record is referenced by exercises or other classifications and cannot be removed.";
  if (error.code === "23505") return "That slug or name is already used.";
  return "The change could not be saved. Reload and try again.";
}

export async function saveTaxonomy(_previous: AdminActionState, data: FormData): Promise<AdminActionState> {
  await requireRole(["admin"]);
  const supabase = await createClient();
  if (data.get("operation") === "delete") {
    const parsed = z.object({ table: taxonomyNameSchema, id: z.uuid(), confirmed: z.literal("1") })
      .safeParse({ table: data.get("table"), id: data.get("id"), confirmed: data.get("confirmDelete") });
    if (!parsed.success) return { error: "Confirm deletion of this unused classification." };
    const { error } = await supabase.from(parsed.data.table).delete().eq("id", parsed.data.id);
    if (error) return { error: mutationError(error) };
  } else {
    const parsed = taxonomyMutationSchema.safeParse({
      table: data.get("table"), id: data.get("id") || null, name: data.get("name"), slug: data.get("slug"),
      description: data.get("description") || "", parentId: data.get("parentId") || null,
      jointId: data.get("jointId") || null, categoryId: data.get("categoryId") || null,
    });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the classification." };
    const value = parsed.data;
    const base = { name: value.name, slug: value.slug };
    const description = value.description || null;
    let error: { code?: string; message: string } | null;
    if (value.table === "equipment") {
      const record = { ...base, description, parent_id: value.parentId, category_id: value.categoryId! };
      ({ error } = value.id ? await supabase.from("equipment").update(record).eq("id", value.id) : await supabase.from("equipment").insert(record));
    } else if (value.table === "joint_actions") {
      const record = { ...base, description, joint_id: value.jointId! };
      ({ error } = value.id ? await supabase.from("joint_actions").update(record).eq("id", value.id) : await supabase.from("joint_actions").insert(record));
    } else if (value.table === "muscles" || value.table === "joints" || value.table === "exercise_families") {
      const record = { ...base, description, parent_id: value.parentId };
      ({ error } = value.id ? await supabase.from(value.table).update(record).eq("id", value.id) : await supabase.from(value.table).insert(record));
    } else if (value.table === "equipment_categories") {
      const record = { ...base, parent_id: value.parentId };
      ({ error } = value.id ? await supabase.from("equipment_categories").update(record).eq("id", value.id) : await supabase.from("equipment_categories").insert(record));
    } else if (value.table === "attachments" || value.table === "movement_patterns") {
      const record = { ...base, description };
      ({ error } = value.id ? await supabase.from(value.table).update(record).eq("id", value.id) : await supabase.from(value.table).insert(record));
    } else {
      ({ error } = value.id ? await supabase.from(value.table).update(base).eq("id", value.id) : await supabase.from(value.table).insert(base));
    }
    if (error) return { error: mutationError(error) };
  }
  updateTag(TAXONOMY_CACHE_TAG);
  revalidatePath("/admin/taxonomies");
  revalidatePath("/admin/submissions", "layout");
  return { error: null, message: "Classification saved. The change is in the admin audit history." };
}

export async function toggleLibraryAsset(_previous: AdminActionState, data: FormData): Promise<AdminActionState> {
  await requireRole(["admin"]);
  const parsed = z.object({ table: z.enum(["rigs", "equipment_assets"]), id: z.uuid(), active: z.enum(["1", "0"]) })
    .safeParse({ table: data.get("table"), id: data.get("id"), active: data.get("active") });
  if (!parsed.success) return { error: "Invalid library asset." };
  const supabase = await createClient();
  const { error } = await supabase.from(parsed.data.table).update({ active: parsed.data.active === "1" }).eq("id", parsed.data.id);
  if (error) return { error: mutationError(error) };
  revalidatePath("/admin/assets");
  return { error: null, message: "Library availability updated." };
}

export async function assignRole(_previous: AdminActionState, data: FormData): Promise<AdminActionState> {
  await requireRole(["admin"]);
  const parsed = z.object({ userId: z.uuid(), role: z.enum(Constants.public.Enums.app_role), comment: z.string().trim().min(5).max(1000) })
    .safeParse({ userId: data.get("userId"), role: data.get("role"), comment: data.get("comment") });
  if (!parsed.success) return { error: "Choose an account, role, and reason of at least five characters." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("assign_application_role", {
    p_user_id: parsed.data.userId, p_role: parsed.data.role, p_comment: parsed.data.comment,
  });
  if (error) return { error: mutationError(error) };
  revalidatePath("/admin/roles");
  return { error: null, message: "Account role updated and audited." };
}
