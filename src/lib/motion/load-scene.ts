import "server-only";
import { Euler, Quaternion } from "three";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { defaultScene, type JointSlug, type RigPose, type WorkshopScene } from "./workshop";
import { workshopSceneSchema } from "./scene-schema";

const degrees = (radians: number) => Math.round((radians * 180 / Math.PI) * 100) / 100;
const quaternionPose = z.object({
  slug: z.string(), x: z.number(), y: z.number(), z: z.number(), w: z.number(),
});
const sharedSceneSchema = z.object({
  durationMs: z.number(), cameraAngle: z.string(),
  equipment: z.unknown().nullable(),
  keyframes: z.array(z.object({ timeMs: z.number(), poses: z.array(quaternionPose) })),
  annotations: z.array(z.unknown()).optional(),
});

function decodePose(x: number, y: number, z: number, w: number) {
  const euler = new Euler().setFromQuaternion(new Quaternion(x, y, z, w), "XYZ");
  return { x: degrees(euler.x), y: degrees(euler.y), z: degrees(euler.z) };
}

export function decodeSharedScene(raw: unknown): WorkshopScene | null {
  const parsed = sharedSceneSchema.safeParse(raw);
  if (!parsed.success) return null;
  const scene = parsed.data;
  const keyframes = scene.keyframes.map((frame) => {
    const poses: RigPose = {};
    for (const pose of frame.poses) {
      poses[pose.slug as JointSlug] = decodePose(pose.x, pose.y, pose.z, pose.w);
    }
    return { timeMs: frame.timeMs, poses };
  });
  const validated = workshopSceneSchema.safeParse({
    durationMs: scene.durationMs, cameraAngle: scene.cameraAngle,
    equipment: scene.equipment, keyframes, annotations: scene.annotations,
  });
  return validated.success ? validated.data : null;
}

export async function loadWorkshopScene(contentId: string): Promise<WorkshopScene | null> {
  const supabase = await createClient();
  const { data: scene, error } = await supabase.from("exercise_scenes")
    .select("id,duration_ms,default_camera_angle")
    .eq("content_id", contentId).maybeSingle();
  if (error) throw error;
  if (!scene) return null;

  const [assets, frames, annotations] = await Promise.all([
    supabase.from("scene_equipment")
      .select("position_x,position_y,position_z,scale,equipment_assets(slug)")
      .eq("scene_id", scene.id).limit(1),
    supabase.from("motion_keyframes")
      .select("id,position_ms,motion_joint_poses(rotation_x,rotation_y,rotation_z,rotation_w,rig_joints(slug))")
      .eq("scene_id", scene.id).order("position_ms"),
    supabase.from("motion_phase_annotations").select("start_ms,end_ms,label,note,joint_actions(slug)")
      .eq("scene_id", scene.id).order("start_ms"),
  ]);
  if (assets.error || frames.error || annotations.error) throw assets.error ?? frames.error ?? annotations.error;
  const asset = assets.data?.[0];
  const equipment = asset && asset.equipment_assets ? {
    slug: asset.equipment_assets.slug,
    x: Number(asset.position_x), y: Number(asset.position_y),
    z: Number(asset.position_z), scale: Number(asset.scale),
  } : null;
  const keyframes = (frames.data ?? []).map((frame) => {
    const poses: RigPose = {};
    for (const pose of frame.motion_joint_poses) {
      if (!pose.rig_joints) continue;
      poses[pose.rig_joints.slug as JointSlug] = decodePose(
        Number(pose.rotation_x), Number(pose.rotation_y),
        Number(pose.rotation_z), Number(pose.rotation_w),
      );
    }
    return { timeMs: frame.position_ms, poses };
  });
  const parsed = workshopSceneSchema.safeParse({
    durationMs: scene.duration_ms,
    cameraAngle: scene.default_camera_angle,
    equipment,
    keyframes,
    annotations: (annotations.data ?? []).map((item) => ({ startMs: item.start_ms, endMs: item.end_ms,
      label: item.label, note: item.note, jointAction: item.joint_actions?.slug ?? null })),
  });
  if (!parsed.success) throw new Error("Saved workshop scene is invalid");
  return parsed.data;
}

export function initialWorkshopScene(equipmentSlugs: string[], saved: WorkshopScene | null): WorkshopScene {
  if (saved) return saved;
  const slug = equipmentSlugs.includes("single-cable") || equipmentSlugs.includes("cable")
    ? "single-cable" : equipmentSlugs.includes("barbell") ? "barbell"
      : equipmentSlugs.includes("dumbbell") ? "dumbbell-pair" : null;
  return { ...defaultScene, equipment: slug ? { slug, x: 0, y: 0, z: 0, scale: 1 } : null };
}
