import { Euler, Quaternion, Vector3 } from "three";
import type { AnatomyRig } from "./anatomy";
import { legPress } from "./leg-press";
import { plateRow } from "./plate-row";
import { chestPress } from "./chest-press";
import { shoulderPress } from "./shoulder-press";
import { supportContactPoint } from "./support-contacts";
import { supportSurfaceFrame } from "./support-surfaces";
import type { StudioLayout, StudioObject } from "./workshop";

type Pad = {
  center: readonly [number, number, number]; size: readonly [number, number, number]; angle: number;
  side: 1 | -1; regions: readonly ("back" | "chest")[];
};
const pads: Partial<Record<StudioObject["slug"], Pad>> = {
  "chest-press-machine": { center: chestPress.back.center, size: chestPress.back.size, angle: chestPress.back.degrees * Math.PI / 180, side: 1, regions: ["back"] },
  "shoulder-press-machine": { center: shoulderPress.back.center, size: shoulderPress.back.size, angle: shoulderPress.back.degrees * Math.PI / 180, side: 1, regions: ["back"] },
  "row-machine": { center: [0, plateRow.pad.y, plateRow.pad.z], size: [.34, .45, .14], angle: 0, side: -1, regions: ["chest"] },
  "pec-deck": { center: [0, 1.3, -.2], size: [.49, 1.05, .14], angle: 0, side: 1, regions: ["back"] },
  "leg-press": { center: legPress.back.center, size: legPress.back.size, angle: legPress.back.degrees * Math.PI / 180, side: 1, regions: ["back"] },
};

/** Signed depth behind a finite pad face, in equipment-local meters. */
export function seatedPadPenetration(rig: AnatomyRig, object: StudioObject, seating?: StudioLayout["seating"]): number {
  let origin: Vector3, rotation: Quaternion, halfWidth: number, minY: number, maxY: number, face: number, side: 1 | -1;
  let regions: readonly ("back" | "chest")[];
  if (object.slug === "bench") {
    if (seating?.benchId !== object.id || seating.facing === "supine" || seating.facing === "prone") return 0;
    const frame = supportSurfaceFrame(object, "pad");
    origin = frame.origin; rotation = frame.rotation;
    halfWidth = .22; minY = 0; maxY = 1.62; face = .045; side = 1;
    regions = seating.facing === "front" ? ["back"] : seating.facing === "back" ? ["chest"] : ["back", "chest"];
  } else {
    const pad = pads[object.slug];
    if (!pad || !object.machineUse) return 0;
    const reverse = object.slug === "pec-deck" && object.machineMode === "reverse";
    side = pad.side; regions = reverse ? ["chest"] : pad.regions;
    rotation = new Quaternion().setFromEuler(new Euler(object.rotationX * Math.PI / 180, object.rotationY * Math.PI / 180, object.rotationZ * Math.PI / 180));
    origin = new Vector3(...pad.center).multiplyScalar(object.scale).applyQuaternion(rotation).add(new Vector3(object.x, object.y, object.z));
    rotation.multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), pad.angle));
    halfWidth = pad.size[0] / 2; minY = -pad.size[1] / 2; maxY = pad.size[1] / 2; face = pad.size[2] / 2;
  }
  const inverse = rotation.invert();
  let penetration = 0;
  for (const region of regions) {
    const anchor = rig.bones.torso.worldToLocal(supportContactPoint(rig, region));
    const shoulder = rig.bones["left-shoulder"].position;
    const width = region === "chest" ? Math.abs(shoulder.x) / 2 : .1;
    const heights = region === "back" ? [anchor.y, shoulder.y] : [anchor.y];
    // Include shoulder-height back contact and chest edges without extending the pad's footprint.
    for (const y of heights) for (const x of [-width, 0, width]) {
      const point = rig.bones.torso.localToWorld(anchor.clone().setX(x).setY(y))
        .sub(origin).applyQuaternion(inverse).divideScalar(object.scale);
      if (Math.abs(point.x) <= halfWidth && point.y >= minY && point.y <= maxY) {
        penetration = Math.max(penetration, face - side * point.z);
      }
    }
  }
  return penetration;
}
