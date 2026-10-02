import "server-only";
import { createClient } from "@/lib/supabase/server";
import { signMediaObjects, mediaObjectKey } from "./signed-media";

export async function loadPrivateRenderMedia(contentId: string) {
  const supabase = await createClient();
  const { data: media, error } = await supabase.from("exercise_media")
    .select("kind,storage_bucket,storage_path,asset_group_id")
    .eq("content_id", contentId).eq("storage_bucket", "exercise-private");
  if (error || !media?.length) return null;
  const signed = await signMediaObjects(media);
  const urls = media.map(item => ({ kind: item.kind, url: signed.get(mediaObjectKey(item)) }));
  return {
    webm: urls.find((item) => item.kind === "webm")?.url ?? null,
    mp4: urls.find((item) => item.kind === "mp4")?.url ?? null,
    poster: urls.find((item) => item.kind === "poster")?.url ?? null,
  };
}
