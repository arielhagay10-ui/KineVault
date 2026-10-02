import "server-only";
import { createClient } from "@/lib/supabase/server";
import { resolveRenderReplacements } from "./render-replacements";

type StorageObject = { storage_bucket: string; storage_path: string };

export function mediaObjectKey(item: StorageObject) {
  return `${item.storage_bucket}/${item.storage_path}`;
}

export async function signMediaObjects(objects: StorageObject[]) {
  const supabase = await createClient();
  const resolved = await resolveRenderReplacements(objects);
  const originalKeys = new Map(resolved.map((item, index) => [mediaObjectKey(item), mediaObjectKey(objects[index])]));
  const buckets = new Map<string, Set<string>>();
  for (const object of resolved) {
    const paths = buckets.get(object.storage_bucket) ?? new Set<string>();
    paths.add(object.storage_path);
    buckets.set(object.storage_bucket, paths);
  }
  const results = await Promise.all([...buckets].map(async ([bucket, paths]) => {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrls([...paths], 900);
    if (error) return [];
    return (data ?? []).flatMap((item): [string, string][] =>
      item.signedUrl && item.path ? [[originalKeys.get(`${bucket}/${item.path}`) ?? `${bucket}/${item.path}`, item.signedUrl]] : []);
  }));
  return new Map<string, string>(results.flat());
}
