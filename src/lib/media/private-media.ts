import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function loadPrivateRenderMedia(contentId: string) {
  const supabase = await createClient();
  const { data: media, error } = await supabase.from("exercise_media")
    .select("kind,storage_bucket,storage_path,asset_group_id")
    .eq("content_id", contentId).eq("storage_bucket", "exercise-private");
  if (error || !media?.length) return null;
  const signed = await Promise.all(media.map(async (item) => {
    const { data } = await supabase.storage.from(item.storage_bucket)
      .createSignedUrl(item.storage_path, 3600);
    return data?.signedUrl ? { kind: item.kind, url: data.signedUrl } : null;
  }));
  const urls = signed.filter((item) => item !== null);
  return {
    webm: urls.find((item) => item.kind === "webm")?.url ?? null,
    mp4: urls.find((item) => item.kind === "mp4")?.url ?? null,
    poster: urls.find((item) => item.kind === "poster")?.url ?? null,
  };
}
