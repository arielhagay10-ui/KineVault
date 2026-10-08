import { Matrix4, Object3D, Quaternion, Vector3 } from "three";
import type { AnatomyRig } from "./anatomy";
import { constrainSupportedWeight, reachStudioGrip, studioGripOffset } from "./studio-grip";
import type { CableAttachment, RigPose, StudioObject } from "./workshop";
import { rowCarriagePoint, rowPulleyPoint } from "./studio-row";

export const cableAttachmentNames: Record<CableAttachment, string> = {
  "d-handle": "D handle", rope: "Rope", "straight-bar": "Straight bar", "angled-bar": "Angled bar", "lat-bar": "Wide-grip lat bar", "v-bar": "V bar", cuff: "Cuff",
};

export function cableLocalGrip(kind: CableAttachment, side: "left" | "right") {
  const sign = side === "left" ? 1 : -1;
  const angle = kind === "angled-bar" ? -sign * Math.PI / 9 : kind === "lat-bar" ? -sign * Math.atan2(.16, .24) : kind === "v-bar" ? -sign * Math.PI / 4 : 0;
  return {
    point: new Vector3(kind === "d-handle" ? 0 : sign * (kind === "lat-bar" ? .5 : kind === "v-bar" ? 0.13 : 0.24), kind === "angled-bar" ? -.24 * Math.tan(Math.PI / 9) : kind === "lat-bar" ? -.08 : kind === "v-bar" ? -0.13 : 0, 0),
    rotation: new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), angle),
  };
}

// Rigid attachments have fixed grip sites. A single hand determines their entire
// frame; two hands share a frame and use IK at each site's actual shaft angle.
export function studioCableFrame(rig: AnatomyRig, object: StudioObject, tower: Object3D, pose: RigPose) {
  tower.updateWorldMatrix(true, false); rig.root.updateWorldMatrix(true, true);
  const kind = object.cableAttachment ?? "d-handle";
  const scale = tower.getWorldScale(new Vector3()).x;
  const row = object.slug === "cable-row-machine", fixed = row && object.machineUse;
  const pulley = tower.localToWorld(row ? new Vector3(rowPulleyPoint.x, rowPulleyPoint.y, rowPulleyPoint.z) : new Vector3(0, object.pulleyHeight, 0.2));
  let center = tower.localToWorld(row ? rowCarriagePoint(object) : new Vector3(0, Math.max(0.38, object.pulleyHeight - 0.35), 0.55));
  let rotation = tower.getWorldQuaternion(new Quaternion());
  const sides: ("left" | "right")[] = object.attachment === "both" ? ["left", "right"] : object.attachment === "none" ? [] : [object.attachment];
  if (kind === "cuff") {
    let cuffRadius = 0.065;
    if (sides.length) {
      const side = sides[0];
      const elbow = rig.bones[`${side}-elbow`].getWorldPosition(new Vector3());
      const shoulder = rig.bones[`${side}-shoulder`].getWorldPosition(new Vector3());
      const wrist = rig.handBones[side].getWorldPosition(new Vector3());
      const upper = object.cuffPosition === "upper-arm";
      center = upper ? elbow.clone().lerp(shoulder, 0.22) : wrist;
      const axis = (upper ? shoulder.clone().sub(elbow) : elbow.clone().sub(wrist)).normalize();
      const outward = pulley.clone().sub(center).addScaledVector(axis, -pulley.clone().sub(center).dot(axis));
      if (outward.lengthSq() < 1e-8) {
        outward.set(0, 0, 1).addScaledVector(axis, -axis.z);
        if (outward.lengthSq() < 1e-8) outward.set(1, 0, 0).addScaledVector(axis, -axis.x);
      }
      outward.normalize();
      rotation = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(axis.clone().cross(outward).normalize(), axis, outward));
      // Cuffs fit the body independently of tower scale.
      cuffRadius = (upper ? 0.075 : 0.055) * rig.root.getWorldScale(new Vector3()).x / 0.85 / scale;
    }
    const connection = new Vector3(0, 0, cuffRadius + 0.015).multiplyScalar(scale).applyQuaternion(rotation).add(center);
    return { kind, center, rotation, scale, connection, pulley, ropeGrips: [], reachable: true, cuffRadius };
  }
  const palms = sides.map(side => ({ side, point: rig.handBones[side].localToWorld(studioGripOffset(side)), rotation: rig.handBones[side].getWorldQuaternion(new Quaternion()) }));
  let reachable = true;
  if (fixed && kind !== "rope") {
    for (const side of sides) {
      const grip = cableLocalGrip(kind, side);
      const target = grip.point.multiplyScalar(scale).applyQuaternion(rotation).add(center);
      reachable = reachStudioGrip(rig, side, target, rotation.clone().multiply(grip.rotation), pose[`${side}-wrist`]) < .005 && reachable;
    }
  } else if (kind !== "rope" && palms.length === 1) {
    const grip = cableLocalGrip(kind, palms[0].side);
    rotation = palms[0].rotation.clone().multiply(grip.rotation.clone().invert());
    center = palms[0].point.clone().sub(grip.point.clone().multiplyScalar(scale).applyQuaternion(rotation));
  } else if (kind !== "rope" && palms.length === 2) {
    center = palms[0].point.clone().add(palms[1].point).multiplyScalar(0.5);
    // Keep a resting two-hand bar in front of the pelvis, including a turned body.
    const body = rig.root.parent;
    if (body) {
      const local = body.worldToLocal(center.clone()); local.z = Math.max(0.4, local.z); center = body.localToWorld(local);
    }
    const x = palms[0].point.clone().sub(palms[1].point);
    if (x.lengthSq() < 1e-8) x.set(1, 0, 0).applyQuaternion(rig.root.getWorldQuaternion(new Quaternion()));
    x.normalize();
    const y = new Vector3(0, 1, 0).addScaledVector(x, -x.y);
    if (y.lengthSq() < 1e-8) y.set(0, 0, 1).addScaledVector(x, -x.z);
    y.normalize();
    rotation = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, y, x.clone().cross(y)));
    center.sub(cableLocalGrip(kind, "left").point.clone().multiplyScalar(scale).applyQuaternion(rotation).projectOnVector(y));
    // Forward clearance can move a fully extended resting arm beyond its reach.
    // Fit the shared frame to each arm's reachable plane before solving the rig.
    for (let iteration = 0; iteration < 4; iteration++) for (const side of sides) {
      const grip = cableLocalGrip(kind, side);
      const shaft = rotation.clone().multiply(grip.rotation);
      const origin = rig.bones[`${side}-shoulder`].getWorldPosition(new Vector3());
      const target = grip.point.multiplyScalar(scale).applyQuaternion(rotation).add(center);
      const gap = target.sub(origin).applyQuaternion(shaft.clone().invert());
      const rigScale = rig.root.getWorldScale(new Vector3()).x;
      const upper = rig.bones[`${side}-elbow`].position.length() * rigScale;
      const lower = rig.handBones[side].position.clone().add(studioGripOffset(side).applyQuaternion(rig.handBones[side].quaternion)).multiplyScalar(rigScale);
      const upperX = gap.x - lower.x;
      if (Math.abs(upperX) >= upper) {
        const slope = y.dot(new Vector3(1, 0, 0).applyQuaternion(shaft));
        if (Math.abs(slope) > 1e-6) {
          const lift = (Math.sign(upperX) * (upper - 0.002 * rigScale) - upperX) / slope;
          if (lift > 0) center.addScaledVector(y, lift);
        }
        continue;
      }
      const radius = Math.sqrt(upper ** 2 - upperX ** 2) + Math.hypot(lower.y, lower.z) - 0.001 * rigScale;
      const distance = Math.hypot(gap.y, gap.z);
      if (distance > radius) center.add(new Vector3(0, gap.y, gap.z).multiplyScalar(radius / distance - 1).applyQuaternion(shaft));
    }
    for (const side of sides) {
      const grip = cableLocalGrip(kind, side);
      const target = grip.point.multiplyScalar(scale).applyQuaternion(rotation).add(center);
      reachable = reachStudioGrip(rig, side, target, rotation.clone().multiply(grip.rotation), pose[`${side}-wrist`]) < 0.005 && reachable;
    }
  }
  let connection = new Vector3(0, kind === "d-handle" ? 0.21 : 0.08, 0).multiplyScalar(scale).applyQuaternion(rotation).add(center);
  const ropeGrips = kind !== "rope" ? [] : palms.length && !fixed ? palms : (["left", "right"] as const).map(side => {
    const sign = side === "left" ? 1 : -1;
    return { side, point: new Vector3(sign * 0.13, fixed ? -.08 : -.28, 0).multiplyScalar(scale).applyQuaternion(rotation).add(center),
      rotation: rotation.clone().multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), -sign * Math.PI / 3)) };
  });
  if (fixed && kind === "rope") for (const grip of ropeGrips.filter(grip => sides.includes(grip.side))) {
    reachable = reachStudioGrip(rig, grip.side, grip.point, grip.rotation, pose[`${grip.side}-wrist`]) < .005 && reachable;
  }
  if (ropeGrips.length) {
    const supports = ropeGrips.map(grip => ({ center: new Vector3(grip.side === "left" ? -0.08 : 0.08, 0, 0).multiplyScalar(scale).applyQuaternion(grip.rotation).add(grip.point), radius: 0.4 * scale }));
    const middle = supports.reduce((sum, item) => sum.add(item.center), new Vector3()).divideScalar(supports.length);
    connection = constrainSupportedWeight(middle.clone().add(pulley.clone().sub(middle).normalize().multiplyScalar(0.4 * scale)), supports);
    reachable = supports.every(support => Math.abs(connection.distanceTo(support.center) - support.radius) < 0.005) && reachable;
    if (palms.length === 1 && !fixed) {
      // Preserve the second end when only one rope grip is held. Near the floor
      // it rests outward rather than disappearing or passing through the floor.
      const side = palms[0].side === "left" ? "right" : "left";
      const sign = side === "left" ? 1 : -1;
      const drop = Math.max(0, Math.min(0.4 * scale, connection.y - 0.23 * scale));
      const outward = pulley.clone().sub(connection).setY(0);
      if (outward.lengthSq() < 1e-8) outward.set(1, 0, 0);
      const direction = outward.normalize().multiplyScalar(Math.sqrt(Math.max(0, (0.4 * scale) ** 2 - drop ** 2))).setY(-drop).normalize();
      const tailRotation = new Quaternion().setFromUnitVectors(new Vector3(sign, 0, 0), direction);
      ropeGrips.push({ side, point: connection.clone().addScaledVector(direction, 0.48 * scale), rotation: tailRotation });
    }
  }
  return { kind, center, rotation, scale, connection, pulley, ropeGrips, reachable, cuffRadius: 0 };
}
