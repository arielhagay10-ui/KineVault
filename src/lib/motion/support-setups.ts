import type { AnatomyRig } from "./anatomy";
import { Euler, Quaternion, Vector3 } from "three";
import { studioPointToWorld } from "./studio";
import { bakeLegacySupportScene, previewSupportSceneReposition } from "./support-contacts";
import { identityTransform, type RigPose, type SupportContact, type WorkshopScene } from "./workshop";

export const supportSetups = ["floor-sitting", "floor-kneeling", "floor-supine", "floor-prone", "bench-hand-knee", "bench-rear-foot"] as const;
export type SupportSetup = typeof supportSetups[number];
export const supportSetupLabels: Record<SupportSetup, string> = { "floor-sitting": "Sit on floor", "floor-kneeling": "Kneel on floor", "floor-supine": "Lie face up", "floor-prone": "Lie face down", "bench-hand-knee": "Hand and knee on bench", "bench-rear-foot": "Rear foot on bench" };

export function createSupportSetup(scene: WorkshopScene, setup: SupportSetup, rig: AnatomyRig): WorkshopScene {
  const source = bakeLegacySupportScene(scene, rig);
  const initialStudio = source.studio ?? { body: { ...identityTransform }, objects: [] };
  const benchId = initialStudio.objects.find(object => object.slug === "bench")?.id;
  const studio = setup === "bench-hand-knee" ? { ...initialStudio, objects: initialStudio.objects.map(object => object.id === benchId ? { ...object, benchAngle: 0 } : object) } : initialStudio;
  const bench = studio.objects.find(object => object.slug === "bench");
  if (setup.startsWith("bench") && !bench) return source;
  let pose: RigPose = {}, supports: SupportContact[] = [];
  const floor = (region: SupportContact["region"], x = 0, z = 0): SupportContact => {
    const position = new Vector3(x, 0, z).applyAxisAngle(new Vector3(0, 1, 0), studio.body.rotationY * Math.PI / 180);
    return { region, objectId: null, surface: "floor", point: { x: studio.body.x + position.x, y: 0, z: studio.body.z + position.z }, normal: { x: 0, y: 1, z: 0 }, turn: studio.body.rotationY };
  };
  const onBench = (region: SupportContact["region"], surface: string, x: number, y: number): SupportContact => ({ region, objectId: bench!.id, surface, point: { x, y, z: .054 }, normal: { x: 0, y: 0, z: 1 }, turn: 0 });
  const body = { ...studio.body, rotationX: 0, rotationZ: 0 };
  if (setup === "floor-sitting") {
    supports = [floor("pelvis")];
    pose = { "left-hip": { x: -90, y: 0, z: 8 }, "right-hip": { x: -90, y: 0, z: -8 }, "left-elbow": { x: 90, y: 0, z: 0 }, "right-elbow": { x: 90, y: 0, z: 0 } };
  } else if (setup === "floor-kneeling") {
    body.y = -.85 * .79 * body.scale + .08 * .85 * body.scale;
    supports = [floor("left-knee", .153 * body.scale), floor("right-knee", -.153 * body.scale)];
    pose = { "left-knee": { x: -140, y: 0, z: 0 }, "right-knee": { x: -140, y: 0, z: 0 } };
  } else if (setup === "floor-supine" || setup === "floor-prone") {
    supports = [floor(setup === "floor-supine" ? "back" : "chest")];
    if (setup === "floor-prone") pose = { "left-knee": { x: -20, y: 0, z: 0 }, "right-knee": { x: -20, y: 0, z: 0 } };
  } else if (setup === "bench-hand-knee") {
    supports = [{ ...onBench("left-hand", "pad", .1, .15), turn: 180 }, onBench("left-knee", "seat", .1, .20)];
    const standing = studioPointToWorld({ x: .65, y: 0, z: .9 }, bench!);
    supports.push({ region: "right-foot", objectId: null, surface: "floor", point: { x: standing.x, y: 0, z: standing.z }, normal: { x: 0, y: 1, z: 0 }, turn: bench!.rotationY + 180 > 180 ? bench!.rotationY - 180 : bench!.rotationY + 180 });
    body.x = .45; body.z = 2.53; body.y = .48;
    const lean = new Euler().setFromQuaternion(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI).multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), 65 * Math.PI / 180)));
    body.rotationX = lean.x * 180 / Math.PI; body.rotationY = lean.y * 180 / Math.PI; body.rotationZ = lean.z * 180 / Math.PI;
    pose = { "left-hip": { x: -120, y: 0, z: -15 }, "left-knee": { x: -145, y: 0, z: 0 }, "left-shoulder": { x: -57, y: -4, z: 4 }, "left-elbow": { x: 62, y: 0, z: 0 }, "left-wrist": { x: 84, y: 24, z: -12 }, "right-shoulder": { x: -65, y: 0, z: 0 }, "right-elbow": { x: 10, y: 0, z: 0 }, "right-hip": { x: -120, y: 0, z: 0 }, "right-knee": { x: -75, y: 0, z: 0 }, "right-ankle": { x: 20, y: 0, z: 0 } };
  } else {
    const standing = studioPointToWorld({ x: .153, y: 0, z: 1.5 }, bench!);
    supports = [onBench("right-foot", "seat", -.12, .24), { region: "left-foot", objectId: null, surface: "floor", point: { x: standing.x, y: 0, z: standing.z }, normal: { x: 0, y: 1, z: 0 }, turn: bench!.rotationY }];
    body.x = 0; body.z = 1.2; body.y = -.04; body.rotationY = 0;
    pose = { "right-hip": { x: 25, y: 0, z: 0 }, "right-knee": { x: -90, y: 0, z: 0 }, "left-hip": { x: -15, y: 0, z: 0 }, "left-knee": { x: -20, y: 0, z: 0 } };
  }
  if (setup.startsWith("bench") && bench) {
    const position = studioPointToWorld(body, bench), radians = Math.PI / 180;
    const rotation = new Quaternion().setFromEuler(new Euler(bench.rotationX * radians, bench.rotationY * radians, bench.rotationZ * radians))
      .multiply(new Quaternion().setFromEuler(new Euler(body.rotationX * radians, body.rotationY * radians, body.rotationZ * radians)));
    const angles = new Euler().setFromQuaternion(rotation);
    Object.assign(body, { x: position.x, y: position.y, z: position.z, rotationX: angles.x / radians, rotationY: angles.y / radians, rotationZ: angles.z / radians });
  }
  const next: WorkshopScene = { ...source, motionStyle: "free", equipment: null, studio: { ...studio, body, seating: undefined, supports }, keyframes: source.keyframes.map(frame => ({ ...frame, poses: { ...pose } })) };
  const preview = previewSupportSceneReposition(next, rig, 0);
  return preview.reachable ? { ...next, studio: { ...next.studio!, body: preview.body } } : next;
}







