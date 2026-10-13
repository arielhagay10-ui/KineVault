import { Quaternion, Vector3 } from "three";
import type { AnatomyRig } from "./anatomy";
import { studioGripOffset } from "./studio-grip";
import { jointLimits, type RigPose } from "./workshop";

/** Fit palm and undirected shaft together, retaining the authored elbow pole. */
export function solveBarbellContact(rig: AnatomyRig, side: "left" | "right", pose: RigPose, target: Vector3, shaft: Vector3, frontalPlane: boolean) {
  if (![...target.toArray(), ...shaft.toArray()].every(Number.isFinite) || shaft.lengthSq() < 1e-10) return { limited: true };
  const shoulder = rig.bones[`${side}-shoulder`], elbow = rig.bones[`${side}-elbow`], hand = rig.handBones[side], forearm = rig.forearmBones[side];
  const rollAxis = hand.position.clone().normalize(), sign = side === "left" ? 1 : -1, radians = Math.PI / 180;
  const scale = rig.root.getWorldScale(new Vector3()).x, pole = elbow.getWorldPosition(new Vector3());
  const limits = jointLimits[`${side}-shoulder`], hinge = pose[`${side}-elbow`] ?? { x: 0, y: 0, z: 0 };
  const roll = sign * 2 * Math.atan2(new Vector3(forearm.quaternion.x, forearm.quaternion.y, forearm.quaternion.z).dot(rollAxis), forearm.quaternion.w);
  const ranges = [limits.x, limits.y, limits.z, [0, 155], [0, 180], [-70, 70], [-30, 30]].map(range => range.map(value => value * radians));
  if (roll < Math.PI / 4) ranges[4][1] = Math.PI / 2;
  if (roll > 3 * Math.PI / 4) ranges[4][0] = Math.PI / 2;
  if (frontalPlane) { ranges[0] = [0, 0]; ranges[1] = [0, 0]; }
  const bound = (values: number[]) => values.map((value, index) => Math.max(ranges[index][0], Math.min(ranges[index][1], value)));
  const reference = bound([shoulder.rotation.x, shoulder.rotation.y, -shoulder.rotation.z, -elbow.rotation.x, roll, hand.rotation.x, hand.rotation.z]);
  const regularization = [1e-7, 1e-4, 1e-7, 1e-7, 1e-7, 1e-7, 1e-7];
  const direction = shaft.clone().normalize();
  const evaluate = (angles: number[]) => {
    shoulder.rotation.set(angles[0], angles[1], -angles[2]);
    elbow.rotation.set(-angles[3], hinge.y * radians, -hinge.z * radians);
    forearm.quaternion.setFromAxisAngle(rollAxis, sign * angles[4]); hand.rotation.set(angles[5], 0, angles[6]);
    const position = hand.localToWorld(studioGripOffset(side)).sub(target).multiplyScalar(20 / scale);
    const axis = new Vector3(1, 0, 0).applyQuaternion(hand.getWorldQuaternion(new Quaternion())).cross(direction).multiplyScalar(2);
    const elbowOffset = elbow.getWorldPosition(new Vector3()).sub(pole).multiplyScalar(.2 / scale);
    return [...position.toArray(), ...axis.toArray(), ...elbowOffset.toArray()];
  };
  const cost = (residual: number[], angles: number[]) => residual.reduce((sum, value) => sum + value * value, 0)
    + angles.reduce((sum, value, index) => sum + regularization[index] * (value - reference[index]) ** 2, 0) + 1e-9 * angles[4] ** 2;
  const seeds = [reference, ...[ranges[4][0], ranges[4][1]].flatMap(turn => [-.4, 0, .4].flatMap(twist => [0, sign * 1.2].map(adduction =>
    bound([reference[0], reference[1] + twist, reference[2] + adduction, Math.min(reference[3], Math.PI / 2), turn, 0, 0]))))];
  let best = reference.slice(), bestCost = Infinity;
  const optimize = (seed: number[], allowGradient: boolean) => {
    let values = seed.slice();
    for (let iteration = 0; iteration < 100; iteration++) {
      const residual = evaluate(values), currentCost = cost(residual, values);
      if (currentCost < bestCost) { best = values.slice(); bestCost = currentCost; }
      if (currentCost < 1e-12) break;
      if (allowGradient && Math.hypot(...residual.slice(0, 3)) * scale / 20 < .00001 && Math.hypot(...residual.slice(3, 6)) / 2 < .0001) break;
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
  for (const seed of seeds) optimize(seed, false);
  evaluate(best);
  if (hand.localToWorld(studioGripOffset(side)).distanceTo(target) >= .00001 || Math.abs(new Vector3(1, 0, 0).applyQuaternion(hand.getWorldQuaternion(new Quaternion())).dot(direction)) < .99999) optimize(best, true);
  evaluate(best);
  const error = hand.localToWorld(studioGripOffset(side)).distanceTo(target);
  const alignment = Math.abs(new Vector3(1, 0, 0).applyQuaternion(hand.getWorldQuaternion(new Quaternion())).dot(direction));
  rig.shoulderCaps[side].quaternion.identity().slerp(shoulder.quaternion, .82);
  rig.root.updateWorldMatrix(true, true); rig.skeleton.update();
  return { limited: error >= .005 || alignment < .985 };
}
