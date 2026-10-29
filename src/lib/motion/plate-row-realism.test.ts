import { expect, it } from "vitest";
import { Group, Quaternion, Vector3 } from "three";
import { createAnatomyRig, poseAnatomyRig } from "./anatomy";
import { applyStudioMachine, machineDemoScene } from "./studio-machines";
import { plateRowGripPoint, reachPlateRowGrip } from "./plate-row";
import { studioGripOffset } from "./studio-grip";

it.each(["neutral", "wide"] as const)("keeps %s row elbows on their anatomical hinge throughout travel", rowGrip => {
  const scene = machineDemoScene("row-machine", crypto.randomUUID()), object = scene.studio!.objects[0];
  const rig = createAnatomyRig(new Group());
  try {
    for (const height of [.56, .66, .78]) for (let step = 0; step <= 16; step++) {
      Object.assign(object, { rowGrip, rowSeatHeight: height, frames: undefined, machinePosition: step / 16 });
      poseAnatomyRig(rig, {}, true); applyStudioMachine(rig, scene, 0);
      for (const side of ["left", "right"] as const) {
        reachPlateRowGrip(rig, object, side, new Quaternion(), {});
        const elbow = rig.bones[`${side}-elbow`], hand = rig.handBones[side];
        const shoulder = rig.bones[`${side}-shoulder`], scale = rig.root.getWorldScale(new Vector3()).x;
        const label = `${rowGrip} ${height} ${step} ${side}`;
        expect(Math.abs(elbow.rotation.y), `${label} elbow sideways`).toBeLessThan(1e-6);
        expect(Math.abs(elbow.rotation.z), `${label} elbow twist`).toBeLessThan(1e-6);
        expect(-elbow.rotation.x * 180 / Math.PI, `${label} elbow flexion`).toBeGreaterThanOrEqual(0);
        expect(-elbow.rotation.x * 180 / Math.PI, `${label} elbow flexion`).toBeLessThanOrEqual(155);
        expect(shoulder.getWorldPosition(new Vector3()).distanceTo(elbow.getWorldPosition(new Vector3())), `${label} upper arm length`).toBeCloseTo(elbow.position.length() * scale, 8);
        expect(elbow.getWorldPosition(new Vector3()).distanceTo(hand.getWorldPosition(new Vector3())), `${label} forearm length`).toBeCloseTo(hand.position.length() * scale, 8);
        const direction = new Vector3(0, -1, 0).applyQuaternion(shoulder.quaternion);
        expect(Math.atan2(-direction.z, -direction.y) * 180 / Math.PI, `${label} rearward extension`).toBeLessThanOrEqual(50 + 1e-6);
        const contactError = hand.localToWorld(studioGripOffset(side)).distanceTo(plateRowGripPoint(object, side));
        if (rowGrip === "neutral" && height === .78 && step === 0) {
          const maximumReach = (elbow.position.length() + hand.position.length() + studioGripOffset(side).length()) * scale;
          const requiredReach = rig.bones[`${side}-shoulder`].getWorldPosition(new Vector3()).distanceTo(plateRowGripPoint(object, side));
          expect(requiredReach - maximumReach).toBeGreaterThan(.005);
          expect(contactError).toBeGreaterThanOrEqual(requiredReach - maximumReach);
        } else expect(contactError, `${label} contact`).toBeLessThan(.005);
        const wrist = new Vector3(0, -1, 0).applyQuaternion(hand.getWorldQuaternion(new Quaternion()))
          .angleTo(hand.getWorldPosition(new Vector3()).sub(elbow.getWorldPosition(new Vector3()))) * 180 / Math.PI;
        expect(wrist, `${label} wrist`).toBeLessThan(45);
      }
    }
  } finally { rig.dispose(); }
});
