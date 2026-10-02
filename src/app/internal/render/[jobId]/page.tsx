import { timingSafeEqual } from "node:crypto";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { RenderFrame } from "@/components/character/render-frame";
import { decodeSharedScene } from "@/lib/motion/load-scene";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function RenderJobPage({ params, searchParams }: {
  params: Promise<{ jobId: string }>; searchParams: Promise<{ refresh?: string }>;
}) {
  const { jobId } = await params;
  const expected = process.env.RENDER_WORKER_TOKEN;
  const supplied = (await headers()).get("x-kinevault-render-token") ?? "";
  if (!expected || expected.length < 32 || supplied.length !== expected.length
    || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) notFound();
  if (!/^[0-9a-f-]{36}$/.test(jobId)) notFound();
  const supabase = createAdminClient();
  const refresh = (await searchParams).refresh === "1";
  const { data, error } = refresh
    ? await supabase.rpc("read_render_refresh_scene", { p_asset_group_id: jobId })
    : await supabase.rpc("read_render_scene", { p_job_id: jobId });
  if (error || !data) notFound();
  const scene = decodeSharedScene(data);
  if (!scene) notFound();
  return <main className="h-[640px] w-[640px] overflow-hidden bg-muted">
    <RenderFrame scene={scene} />
  </main>;
}
