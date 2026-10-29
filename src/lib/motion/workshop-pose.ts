import { jointSlugs, type JointSlug, type WorkshopScene } from "./workshop";
import { isStudioMachine, setMachinePosition } from "./studio-machines";
import { setStudioObjectAnimated } from "./studio";

export function resetWorkshopJoints(scene: WorkshopScene, selectedFrame: number, scope: "selected" | "all", blockedJoints: JointSlug[]): WorkshopScene {
  const machine = scene.studio?.objects.find(item => item.machineUse && isStudioMachine(item.slug));
  const studio = scene.studio && machine ? { ...scene.studio, objects: scene.studio.objects.map(item => {
    if (item.id !== machine.id) return item;
    const times = scope === "all" ? [...new Set([...scene.keyframes.map(frame => frame.timeMs), ...(item.frames ?? []).map(frame => frame.timeMs)])]
      : [scene.keyframes[selectedFrame].timeMs];
    let reset = setStudioObjectAnimated(item, true, times[0], scene.keyframes.map(frame => frame.timeMs));
    for (const time of times) reset = setMachinePosition(reset, item.slug === "smith-machine" ? 1 : 0, time);
    return item.slug === "row-machine" ? { ...reset, rowFootSupport: true } : reset;
  }) } : scene.studio;
  return { ...scene, studio, motionStyle: "free", keyframes: scene.keyframes.map((frame, index) => {
    if (scope !== "all" && index !== selectedFrame) return frame;
    const poses = { ...frame.poses };
    for (const slug of jointSlugs) if (machine || !blockedJoints.includes(slug)) delete poses[slug];
    return { ...frame, poses };
  }) };
}
