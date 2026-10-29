import { Quaternion, Vector3, type Matrix4, type Plane } from "three";
import type { AnatomyRig } from "./anatomy";
import { studioGripOffset } from "./studio-grip";
import { clampJointControlAngles, jointControlRange, jointLimits, type RigPose } from "./workshop";

export function armTorsoClearance(rig: AnatomyRig, side: "left" | "right", torsoInverse: Matrix4 = rig.bones.torso.matrixWorld.clone().invert()) {
  const upper = rig.bones[`${side}-shoulder`].getWorldPosition(new Vector3()).applyMatrix4(torsoInverse);
  const hinge = rig.bones[`${side}-elbow`].getWorldPosition(new Vector3()).applyMatrix4(torsoInverse);
  const wrist = rig.handBones[side].getWorldPosition(new Vector3()).applyMatrix4(torsoInverse);
  const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
  const samples: [Vector3, Vector3, number][] = [[upper, hinge, .7], [upper, hinge, .85], [upper, hinge, 1], [hinge, wrist, .25], [hinge, wrist, .5], [hinge, wrist, .75]];
  return samples.map(([start, end, at]) => {
    const point = start.clone().lerp(end, at);
    const radiusX = .305 + .14 * smooth((point.y - .25) / .35);
    const lateral = point.x / radiusX;
    const front = .1 + .275 * Math.sqrt(Math.max(0, 1 - lateral * lateral));
    return Math.max(0, front - point.z) * smooth((radiusX - Math.abs(point.x)) / .04)
      * smooth((point.y - .02) / .1) * smooth((.88 - point.y) / .1);
  });
}

/** Fit palm and undirected shaft together, retaining the authored elbow pole. */
export function solveBarbellContact(rig: AnatomyRig, side: "left" | "right", pose: RigPose, target: Vector3, shaft: Vector3, frontalPlane: boolean,
  { palmNormal, palmHeading, palmRotation, palmOffset = studioGripOffset(side), preserveArm = false, preserveFlexion = false, wristLimits, localFirst = false, constrainShoulder = false, torsoClearance = false, elbowPlane }: { palmNormal?: Vector3; palmHeading?: Vector3; palmRotation?: Quaternion; palmOffset?: Vector3; preserveArm?: boolean; preserveFlexion?: boolean; wristLimits?: { flexion: number; deviation: number }; localFirst?: boolean; constrainShoulder?: boolean; torsoClearance?: boolean; elbowPlane?: Plane } = {}) {
  if (![...target.toArray(), ...shaft.toArray()].every(Number.isFinite) || shaft.lengthSq() < 1e-10) return { limited: true };
  const shoulder = rig.bones[`${side}-shoulder`], elbow = rig.bones[`${side}-elbow`], hand = rig.handBones[side], forearm = rig.forearmBones[side];
  const rollAxis = hand.position.clone().normalize(), sign = side === "left" ? 1 : -1, radians = Math.PI / 180;
  const scale = rig.root.getWorldScale(new Vector3()).x, pole = elbow.getWorldPosition(new Vector3());
  const limits = jointLimits[`${side}-shoulder`], hinge = pose[`${side}-elbow`] ?? { x: 0, y: 0, z: 0 };
  const roll = sign * 2 * Math.atan2(new Vector3(forearm.quaternion.x, forearm.quaternion.y, forearm.quaternion.z).dot(rollAxis), forearm.quaternion.w);
  const flexion = Math.min(70, wristLimits?.flexion ?? 70), deviation = Math.min(30, wristLimits?.deviation ?? 30);
  const shoulderRanges = constrainShoulder ? (["x", "y", "z"] as const).map(axis => jointControlRange(`${side}-shoulder`, axis)) : [limits.x, limits.y, limits.z];
  const ranges = [...shoulderRanges, [0, 155], [0, 180], [-flexion, flexion], [-deviation, deviation]].map(range => range.map(value => value * radians));
  if (!palmNormal && !elbowPlane && roll < Math.PI / 4) ranges[4][1] = Math.PI / 2;
  if (!palmNormal && !elbowPlane && roll > 3 * Math.PI / 4) ranges[4][0] = Math.PI / 2;
  if (frontalPlane) { ranges[0] = [0, 0]; ranges[1] = [0, 0]; }
  if (preserveFlexion) {
    ranges[0] = [shoulder.rotation.x, shoulder.rotation.x]; ranges[3] = [-elbow.rotation.x, -elbow.rotation.x];
  }
  // A shared head has free palm heading; retain authored tilt instead of flipping it.
  if (preserveFlexion || palmNormal && !palmHeading) ranges[6] = [hand.rotation.z, hand.rotation.z];
  if (preserveArm) [shoulder.rotation.x, shoulder.rotation.y, -shoulder.rotation.z, -elbow.rotation.x].forEach((angle, index) => { ranges[index] = [angle, angle]; });
  const bound = (values: number[]) => {
    const bounded = values.map((value, index) => Math.max(ranges[index][0], Math.min(ranges[index][1], value)));
    if (constrainShoulder) {
      const shoulder = clampJointControlAngles(`${side}-shoulder`, { x: bounded[0] / radians, y: bounded[1] / radians, z: bounded[2] / radians });
      bounded.splice(0, 3, shoulder.x * radians, shoulder.y * radians, shoulder.z * radians);
    }
    return bounded;
  };
  const reference = bound([shoulder.rotation.x, shoulder.rotation.y, -shoulder.rotation.z, -elbow.rotation.x, roll, hand.rotation.x, hand.rotation.z]);
  const shoulderReference = shoulder.quaternion.clone();
  const regularization = palmNormal ? [.001, .001, .001, .001, .02, .02, .02] : [1e-7, 1e-4, 1e-7, 1e-7, 1e-7, 1e-7, 1e-7];
  const direction = shaft.clone().normalize();
  const positionWeight = palmNormal ? 40 : elbowPlane ? 60 : 20;
  const torsoInverse = rig.bones.torso.matrixWorld.clone().invert();
  const elbowPlaneError = () => elbowPlane ? elbowPlane.distanceToPoint(elbow.getWorldPosition(new Vector3())) / scale : 0;
  const palmRotationError = () => palmRotation ? hand.getWorldQuaternion(new Quaternion()).angleTo(palmRotation) : 0;
  const wristError = () => elbowPlane ? Math.max(0, new Vector3(0, -1, 0).applyQuaternion(hand.getWorldQuaternion(new Quaternion()))
    .angleTo(hand.getWorldPosition(new Vector3()).sub(elbow.getWorldPosition(new Vector3()))) - 42 * radians) : 0;
  // Atlas torso envelope in torso-local units, expanded by about .065 for
  // arm volume. Soft edges let overhead arms leave the torso region smoothly.
  const clearance = () => armTorsoClearance(rig, side, torsoInverse);
  const evaluate = (angles: number[]) => {
    shoulder.rotation.set(angles[0], angles[1], -angles[2]);
    elbow.rotation.set(-angles[3], hinge.y * radians, -hinge.z * radians);
    forearm.quaternion.setFromAxisAngle(rollAxis, sign * angles[4]); hand.rotation.set(angles[5], 0, angles[6]);
    const position = preserveArm ? new Vector3() : hand.localToWorld(palmOffset.clone()).sub(target).multiplyScalar(positionWeight / scale);
    const world = hand.getWorldQuaternion(new Quaternion());
    const palmOffsetRotation = palmRotation?.clone().invert().multiply(world);
    const axis = new Vector3(1, 0, 0).applyQuaternion(world);
    // A round dumbbell head permits any heading around its supporting normal.
    if (palmNormal) {
      if (palmHeading) axis.sub(palmHeading); else axis.set(0, 0, 0);
    } else axis.cross(direction);
    axis.multiplyScalar(localFirst ? 8 : 2);
    const normal = palmNormal ? new Vector3(0, 0, 1).applyQuaternion(world).sub(palmNormal).multiplyScalar(2) : new Vector3();
    // Quaternion distance retains the elbow branch even when shoulder Euler angles approach a singularity.
    const rotationOffset = shoulderReference.clone().invert().multiply(shoulder.quaternion);
    const elbowOffset = elbow.getWorldPosition(new Vector3()).sub(pole).multiplyScalar((localFirst ? 1 : .2) / scale);
    return [...position.toArray(), ...axis.toArray(), ...elbowOffset.toArray(), ...normal.toArray(),
      ...(elbowPlane ? [elbowPlaneError() * 20, wristError() * 8] : []),
      ...(palmOffsetRotation ? [palmOffsetRotation.x, palmOffsetRotation.y, palmOffsetRotation.z].map(value => value * (palmOffsetRotation.w < 0 ? -16 : 16)) : []),
      ...(palmNormal && !preserveArm ? [rotationOffset.x, rotationOffset.y, rotationOffset.z] : []),
      ...((palmNormal || torsoClearance) && !preserveArm ? clearance().map(distance => distance * 20) : [])];
  };
  const cost = (residual: number[], angles: number[]) => residual.reduce((sum, value) => sum + value * value, 0)
    + angles.reduce((sum, value, index) => sum + regularization[index] * (value - reference[index]) ** 2, 0) + 1e-9 * angles[4] ** 2;
  // A supporting palm has no shaft-heading ambiguity. Starting from the
  // authored pose keeps that free heading continuous and avoids redundant fits.
  const seeds = palmNormal && !preserveArm ? [reference]
    : preserveArm ? [reference, ...[ranges[4][0], ranges[4][1]].map(turn => bound([...reference.slice(0, 4), turn, 0, 0]))]
    : [reference, ...[ranges[4][0], ranges[4][1]].flatMap(turn => [-.4, 0, .4].flatMap(twist => [0, sign * 1.2].map(adduction =>
    bound([reference[0], reference[1] + twist, reference[2] + adduction, Math.min(reference[3], Math.PI / 2), turn, 0, 0]))))];
  if (localFirst && !preserveArm && !preserveFlexion && !frontalPlane) {
    if (elbowPlane) for (const twist of [-.5, 0, .5]) seeds.push(bound([-Math.PI / 2, twist, -sign * 1.3, Math.PI / 2, Math.PI / 2, 0, 0]));
    for (const flexion of [-.8, -1.8, -2.5]) for (const abduction of [.4, 1]) {
      seeds.push(bound([flexion, 0, -sign * abduction, Math.PI / 2, Math.PI / 2, 0, 0]));
    }
  }
  let best = reference.slice(), bestCost = Infinity;
  const optimize = (seed: number[], allowGradient: boolean) => {
    let values = seed.slice();
    for (let iteration = 0; iteration < 100; iteration++) {
      const residual = evaluate(values), currentCost = cost(residual, values);
      if (currentCost < bestCost) { best = values.slice(); bestCost = currentCost; }
      if (localFirst && !palmNormal && Math.hypot(...residual.slice(0, 3)) * scale / positionWeight < .001
        && Math.hypot(...residual.slice(3, 6)) / 8 < .03 && (!torsoClearance || clearance().every(distance => distance < .001)) && Math.abs(elbowPlaneError()) < .001 && wristError() < .001 && palmRotationError() < .001) break;
      if (currentCost < 1e-12) break;
      if (allowGradient && Math.hypot(...residual.slice(0, 3)) * scale / positionWeight < .00001 && Math.hypot(...residual.slice(3, 6)) / 2 < .0001
        && (!palmNormal || Math.hypot(...residual.slice(9, 12)) / 2 < .0001 && residual.slice(15).every(value => value < .0001))
        && (!torsoClearance || clearance().every(distance => distance < .001)) && Math.abs(elbowPlaneError()) < .001 && wristError() < .001 && palmRotationError() < .001) break;
      const jacobian = values.map((value, index) => {
        if (ranges[index][0] === ranges[index][1]) return residual.map(() => 0);
        const trial = values.slice(); trial[index] = value + .0001;
        return evaluate(trial).map((component, row) => (component - residual[row]) / .0001);
      });
      const active = new Set<number>();
      let correction: number[] = [];
      for (let pass = 0; pass <= values.length; pass++) {
        const matrix = jacobian.map((column, row) => [
          ...jacobian.map((other, index) => active.has(row) || active.has(index) ? (row === index ? 1 : 0) : column.reduce((sum, value, component) => sum + value * other[component], row === index ? .000001 + regularization[row] : 0)),
          active.has(row) ? 0 : -column.reduce((sum, value, component) => sum + value * residual[component], 0) - regularization[row] * (values[row] - reference[row]),
        ]);
        for (let pivot = 0; pivot < values.length; pivot++) {
          const divisor = matrix[pivot][pivot];
          for (let column = pivot; column <= values.length; column++) matrix[pivot][column] /= divisor;
          for (let row = 0; row < values.length; row++) if (row !== pivot) {
            const factor = matrix[row][pivot];
            for (let column = pivot; column <= values.length; column++) matrix[row][column] -= factor * matrix[pivot][column];
          }
        }
        correction = matrix.map(row => row[values.length]);
        let changed = false;
        correction.forEach((step, index) => {
          if (!active.has(index) && (values[index] <= ranges[index][0] + 1e-8 && step < 0 || values[index] >= ranges[index][1] - 1e-8 && step > 0)) { active.add(index); changed = true; }
        });
        if (!changed) break;
      }
      let accepted = false;
      const largestCorrection = Math.max(.2, ...correction.map(Math.abs));
      for (const step of [1, .5, .25, .1]) {
        const trial = bound(values.map((value, index) => value + step * .2 * correction[index] / largestCorrection));
        if (cost(evaluate(trial), trial) < currentCost) { values = trial; accepted = true; break; }
      }
      if (!accepted && allowGradient) {
        // A clipped Newton step can freeze mutually dependent joints even
        // when one bound still has an inward descent direction.
        const descent = jacobian.map((column, index) => {
          const gradient = column.reduce((sum, value, component) => sum + value * residual[component], 0) + regularization[index] * (values[index] - reference[index]);
          return values[index] <= ranges[index][0] + 1e-8 && gradient > 0 || values[index] >= ranges[index][1] - 1e-8 && gradient < 0 ? 0 : -gradient;
        });
        const largest = Math.max(...descent.map(Math.abs), 1e-12);
        for (const step of [1, .5, .25, .1, .01]) {
          const trial = bound(values.map((value, index) => value + .05 * step * descent[index] / largest));
          if (cost(evaluate(trial), trial) < currentCost) { values = trial; accepted = true; break; }
        }
      }
      if (!accepted) break;
    }
    const finalCost = cost(evaluate(values), values);
    if (finalCost < bestCost) { best = values.slice(); bestCost = finalCost; }
  };
  for (const seed of seeds) {
    optimize(seed, false);
    if (localFirst && !palmNormal) {
      evaluate(best);
      const actualAxis = new Vector3(1, 0, 0).applyQuaternion(hand.getWorldQuaternion(new Quaternion()));
      if (hand.localToWorld(palmOffset.clone()).distanceTo(target) < .001 && Math.abs(actualAxis.dot(direction)) > .9995
        && (!torsoClearance || clearance().every(distance => distance < .001)) && Math.abs(elbowPlaneError()) < .001 && wristError() < .001 && palmRotationError() < .001) break;
    }
  }
  evaluate(best);
  const aligned = () => palmNormal ? Math.min(new Vector3(0, 0, 1).applyQuaternion(hand.getWorldQuaternion(new Quaternion())).dot(palmNormal),
    palmHeading ? new Vector3(1, 0, 0).applyQuaternion(hand.getWorldQuaternion(new Quaternion())).dot(palmHeading) : 1)
    : Math.abs(new Vector3(1, 0, 0).applyQuaternion(hand.getWorldQuaternion(new Quaternion())).dot(direction));
  if (hand.localToWorld(palmOffset.clone()).distanceTo(target) >= .00001 || aligned() < .99999
    || Math.abs(elbowPlaneError()) >= .001 || wristError() >= .001 || palmRotationError() >= .001 || (palmNormal || torsoClearance) && !preserveArm && clearance().some(distance => distance > .001)) optimize(best, true);
  evaluate(best);
  const error = hand.localToWorld(palmOffset.clone()).distanceTo(target);
  const alignment = aligned();
  rig.shoulderCaps[side].quaternion.identity().slerp(shoulder.quaternion, .82);
  rig.root.updateWorldMatrix(true, true); rig.skeleton.update();
  const clearanceLimited = (!!palmNormal || torsoClearance) && !preserveArm && clearance().some(distance => distance > .01);
  return { limited: error >= .005 || alignment < .985 || palmRotationError() > .035 || clearanceLimited, clearanceLimited };
}
