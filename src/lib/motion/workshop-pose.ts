import { jointSlugs, type JointSlug, type WorkshopScene } from "./workshop";

export function resetWorkshopJoints(scene: WorkshopScene, selectedFrame: number, scope: "selected" | "all", blockedJoints: JointSlug[]): WorkshopScene {
  return { ...scene, motionStyle: "free", keyframes: scene.keyframes.map((frame, index) => {
    if (scope !== "all" && index !== selectedFrame) return frame;
    const poses = { ...frame.poses };
    for (const slug of jointSlugs) if (!blockedJoints.includes(slug)) delete poses[slug];
    return { ...frame, poses };
  }) };
}
