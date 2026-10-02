import "server-only";
import { createClient } from "@/lib/supabase/server";

type MediaObject = { storage_bucket: string; storage_path: string };
export async function resolveRenderReplacements<T extends MediaObject>(objects: T[]): Promise<T[]> {
  if (!objects.length) return objects;
  const supabase = await createClient();
  const { data, error } = await supabase.from("media_render_replacements")
    .select("storage_bucket,original_path,replacement_path,license_name,source_credit")
    .in("original_path", [...new Set(objects.map(item => item.storage_path))]).order("created_at", { ascending: false });
  if (error) throw new Error("The current demonstration renders could not be loaded");
  const replacements = new Map<string, NonNullable<typeof data>[number]>();
  for (const item of data ?? []) {
    const key = `${item.storage_bucket}/${item.original_path}`;
    if (!replacements.has(key)) replacements.set(key, item);
  }
  return objects.map(item => {
    const replacement = replacements.get(`${item.storage_bucket}/${item.storage_path}`);
    return replacement ? { ...item, storage_path: replacement.replacement_path, license_name: replacement.license_name, source_credit: replacement.source_credit } : item;
  });
}
