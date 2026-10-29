import { createHeldWeightPoseSampler } from "./held-weight-pose";
import { clampJointControlAngles, type WorkshopScene } from "./workshop";

export function releaseTBarFeet(scene: WorkshopScene): WorkshopScene {
  const machine = scene.studio?.objects.find(item => item.slug === "t-bar-row-machine" && item.machineUse);
  if (!machine || machine.rowFootSupport === false) return scene;
  const sampler = createHeldWeightPoseSampler();
  try {
    const keyframes = scene.keyframes.map(frame => {
      const displayed = sampler.sample(scene, frame.timeMs), poses = { ...frame.poses };
      for (const side of ["left", "right"] as const) for (const part of ["hip", "knee", "ankle"] as const) {
        const joint = `${side}-${part}` as const;
        if (displayed[joint]) poses[joint] = clampJointControlAngles(joint, displayed[joint]);
      }
      return { ...frame, poses };
    });
    return { ...scene, keyframes, studio: { ...scene.studio!, objects: scene.studio!.objects.map(item => item.id === machine.id ? { ...item, rowFootSupport: false } : item) } };
  } finally { sampler.dispose(); }
}
