import { Bone, Box3, Float32BufferAttribute, Group, Line3, Matrix4, Mesh, MeshStandardMaterial, Quaternion, Skeleton, SkinnedMesh, Uint16BufferAttribute, Vector3 } from "three";
import type { JointSlug, RigPose } from "./workshop";

export const anatomyModelUrl = "/models/z-anatomy/model.glb";
export const muscleGroups = [
  { id: "deltoid", label: "Shoulders (deltoids)", pattern: /deltoid/ },
  { id: "reardelts", label: "Rear shoulders (posterior deltoids)", pattern: /scapular_spinal_part_of_deltoid/ },
  { id: "biceps", label: "Biceps", pattern: /biceps_brachii/ },
  { id: "triceps", label: "Triceps — all heads", pattern: /triceps_brachii/ },
  { id: "traps", label: "Traps (trapezius) — all parts", pattern: /trapezius/ },
  { id: "chest", label: "Chest (pectoralis major)", pattern: /pectoralis_major/ },
  { id: "lats", label: "Lats (latissimus dorsi)", pattern: /latissimus/ },
  { id: "abs", label: "Abdominals", pattern: /rectus_abdominis|oblique.*abdom|transversus_abdom/ },
  { id: "glutes", label: "Glutes", pattern: /gluteus/ },
  { id: "quadriceps", label: "Quadriceps", pattern: /rectus_femoris|vastus_(medialis|lateralis|intermedius)/ },
  { id: "hamstrings", label: "Hamstrings", pattern: /biceps_femoris|semitendinosus|semimembranosus/ },
  { id: "calves", label: "Calves", pattern: /gastrocnemius|soleus/ },
] as const;

export type MuscleOption = { id: string; label: string };
export function muscleLabel(name: string) {
  const spaced = name.replace(/_/g, " ");
  const side = spaced.match(/([lr])$/)?.[1];
  return side ? `${spaced.slice(0, -1)} (${side === "l" ? "left" : "right"})` : spaced;
}

// Pivots in the source atlas coordinate space (height ~3.24). Left is +X.
type MainJoint = Exclude<JointSlug, "left-wrist" | "right-wrist" | "left-ankle" | "right-ankle">;
const pivots: Record<MainJoint | "pelvis", [number, number, number]> = {
  pelvis: [0, 1.73, -0.08], torso: [0, 1.73, -0.08],
  "left-shoulder": [0.34, 2.64, -0.08], "right-shoulder": [-0.34, 2.64, -0.08],
  "left-elbow": [0.42, 2.1, -0.1], "right-elbow": [-0.42, 2.1, -0.1],
  "left-hip": [0.16, 1.72, -0.07], "right-hip": [-0.16, 1.72, -0.07],
  "left-knee": [0.18, 0.79, -0.04], "right-knee": [-0.18, 0.79, -0.04],
};
const parents: Partial<Record<MainJoint, MainJoint | "pelvis">> = {
  torso: "pelvis", "left-shoulder": "torso", "right-shoulder": "torso",
  "left-elbow": "left-shoulder", "right-elbow": "right-shoulder",
  "left-hip": "pelvis", "right-hip": "pelvis", "left-knee": "left-hip", "right-knee": "right-hip",
};
const smooth = (low: number, high: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
};

export function createAnatomyRig(source: Group) {
  const root = new Group();
  const bones = {} as Record<JointSlug | "pelvis", Bone>;
  const names = Object.keys(pivots) as (keyof typeof pivots)[];
  const indices = new Map(names.map((name, index) => [name, index]));
  for (const name of names) {
    const bone = new Bone(); bone.name = name;
    const parent = name === "pelvis" ? undefined : parents[name];
    bone.position.fromArray(pivots[name]);
    if (parent) { bone.position.sub(new Vector3(...pivots[parent])); bones[parent].add(bone); }
    else root.add(bone);
    bones[name] = bone;
  }
  const handBones = {} as Record<"left" | "right", Bone>;
  const forearmBones = {} as Record<"left" | "right", Bone>;
  const allBones = names.map(name => bones[name]);
  const shoulderCaps = {} as Record<"left" | "right", Bone>;
  const footBones = {} as Record<"left" | "right", Bone>;
  for (const side of ["left", "right"] as const) {
    const cap = new Bone(); cap.name = `${side}-shoulder-cap`;
    cap.position.copy(bones[`${side}-shoulder`].position); bones.torso.add(cap);
    shoulderCaps[side] = cap; allBones.push(cap);
    const foot = new Bone(); foot.name = `${side}-foot`;
    foot.position.set(0, -0.65, 0); bones[`${side}-knee`].add(foot);
    footBones[side] = foot; bones[`${side}-ankle`] = foot; allBones.push(foot);
  }
  const fingerSegments: { bone: Bone; index: number; name: string; side: "left" | "right"; part: string; thumb: boolean; line: Line3 }[] = [];
  source.updateMatrixWorld(true);
  for (const side of ["left", "right"] as const) {
    const forearm = new Bone(); forearm.name = `${side}-forearm`;
    bones[`${side}-elbow`].add(forearm); forearmBones[side] = forearm; allBones.push(forearm);
    const hand = new Bone(); hand.name = `${side}-hand`;
    const wrist = new Vector3(side === "left" ? 0.49 : -0.49, 1.6, 0);
    hand.position.copy(wrist).sub(new Vector3(...pivots[`${side}-elbow`]));
    forearm.add(hand); handBones[side] = hand; bones[`${side}-wrist`] = hand; allBones.push(hand);
    for (const finger of ["first", "second", "third", "fourth", "fifth"]) {
      let parent = hand, parentPosition = wrist;
      for (const part of ["Proximal", "Middle", "Distal"]) {
        const meshName = `${part}_phalanx_of_${finger}_finger_of_hand${side === "left" ? "l" : "r"}`;
        const mesh = source.getObjectByName(meshName);
        if (!(mesh instanceof Mesh)) continue;
        const box = new Box3().setFromObject(mesh);
        const top = box.getCenter(new Vector3()); top.y = box.max.y;
        const bottom = box.getCenter(new Vector3()); bottom.y = box.min.y;
        const bone = new Bone(); bone.name = meshName;
        bone.position.copy(top).sub(parentPosition); parent.add(bone);
        fingerSegments.push({ bone, index: allBones.length, name: meshName, side, part, thumb: finger === "first", line: new Line3(top, bottom) });
        allBones.push(bone); parent = bone; parentPosition = top;
      }
    }
  }
  root.updateMatrixWorld(true);
  const skeleton = new Skeleton(allBones);
  skeleton.calculateInverses();
  const meshes: SkinnedMesh[] = [];
  const muscles: MuscleOption[] = [];
  source.updateMatrixWorld(true);
  source.traverse(object => {
    if (!(object instanceof Mesh)) return;
    const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld);
    const box = new Box3().setFromBufferAttribute(geometry.getAttribute("position"));
    const center = box.getCenter(new Vector3());
    const name = object.name.toLowerCase();
    const arm = /deltoid|biceps_brachii|triceps_brachii|brachialis|coracobrachialis|humerus/.test(name)
      || (Math.abs(center.x) > 0.4 && center.y > 1.13);
    const pelvicBone = /hip_bone|sacrum/.test(name);
    const leg = !arm && !pelvicBone && center.y < 1.78 && Math.abs(center.x) > 0.06;
    const side = center.x > 0 ? "left" : "right";
    const rigid = object.userData.system === "skeleton";
    const positions = geometry.getAttribute("position");
    const finger = fingerSegments.find(segment => segment.name === object.name);
    const handIndex = allBones.indexOf(handBones[side]);
    const vertex = new Vector3(), closest = new Vector3();
    const skinIndices = new Uint16Array(positions.count * 4);
    const skinWeights = new Float32Array(positions.count * 4);
    for (let index = 0; index < positions.count; index++) {
      const y = rigid ? center.y : positions.getY(index);
      let a: keyof typeof pivots = "pelvis", b: keyof typeof pivots = "torso";
      let weight = smooth(1.65, 1.88, y);
      if (pelvicBone) weight = 0;
      if (arm) {
        a = `${side}-shoulder`; b = `${side}-elbow`;
        weight = 1 - smooth(2.03, 2.18, y);
        if (rigid) weight = center.y < 2.12 ? 1 : 0;
      } else if (leg) {
        a = `${side}-hip`; b = `${side}-knee`;
        weight = 1 - smooth(0.71, 0.86, y);
        if (rigid) weight = center.y < 0.81 ? 1 : 0;
        // Blend the upper leg into the pelvis at its attachment.
        const attachmentStart = /gluteus/.test(name) ? 1.35 : 1.6;
        const attachmentEnd = /gluteus/.test(name) ? 1.7 : 1.83;
        if (!rigid && y > attachmentStart) { b = "pelvis"; weight = smooth(attachmentStart, attachmentEnd, y); }
      }
      skinIndices[index * 4] = indices.get(a)!;
      skinIndices[index * 4 + 1] = indices.get(b)!;
      if (arm) skinIndices[index * 4 + 1] = allBones.indexOf(forearmBones[side]);
      skinWeights[index * 4] = 1 - weight;
      skinWeights[index * 4 + 1] = weight;
      // The deltoid's clavicle/scapula origin stays on the torso as the arm rises.
      if (!rigid && /deltoid/.test(name)) {
        const capWeight = smooth(2.28, 2.57, y);
        const attachmentWeight = Math.max(smooth(2.60, 2.69, y), 1 - smooth(0.24, 0.36, Math.abs(positions.getX(index))));
        skinWeights[index * 4] = (1 - capWeight) * (1 - attachmentWeight);
        skinIndices[index * 4 + 1] = allBones.indexOf(shoulderCaps[side]);
        skinWeights[index * 4 + 1] = capWeight * (1 - attachmentWeight);
        skinIndices[index * 4 + 2] = indices.get("torso")!;
        skinWeights[index * 4 + 2] = attachmentWeight;
      }
      if (leg && y < 0.3) {
        const footWeight = rigid ? 1 : 1 - smooth(0.18, 0.30, y);
        skinIndices[index * 4] = indices.get(`${side}-knee`)!;
        skinIndices[index * 4 + 1] = allBones.indexOf(footBones[side]);
        skinWeights[index * 4] = 1 - footWeight; skinWeights[index * 4 + 1] = footWeight;
      }
      if (arm && y < 1.61) {
        let handWeight = 1 - smooth(1.56, 1.64, y);
        // Rigid hand bones follow the wrist; phalanges follow their own joints.
        if (rigid) handWeight = 1;
        skinIndices[index * 4] = allBones.indexOf(forearmBones[side]);
        skinIndices[index * 4 + 1] = handIndex;
        skinWeights[index * 4] = 1 - handWeight;
        skinWeights[index * 4 + 1] = handWeight;
        let segment = finger;
        if (!rigid && y < 1.49) {
          vertex.fromBufferAttribute(positions, index);
          let distance = Infinity;
          for (const candidate of fingerSegments) {
            if (candidate.side !== side) continue;
            candidate.line.closestPointToPoint(vertex, true, closest);
            const next = vertex.distanceToSquared(closest);
            if (next < distance) { distance = next; segment = candidate; }
          }
          if (distance > 0.003) segment = undefined;
        }
        if (segment) {
          skinIndices[index * 4] = segment.index;
          skinWeights[index * 4] = 1; skinWeights[index * 4 + 1] = 0;
        }
      }
    }
    geometry.setAttribute("skinIndex", new Uint16BufferAttribute(skinIndices, 4));
    geometry.setAttribute("skinWeight", new Float32BufferAttribute(skinWeights, 4));
    const material = new MeshStandardMaterial({ color: rigid ? "#ddd8cb" : "#8e9994", roughness: 0.8 });
    const mesh = new SkinnedMesh(geometry, material);
    mesh.name = object.name; mesh.userData = { ...object.userData };
    // The limbs move beyond the original static bounds.
    mesh.frustumCulled = false;
    mesh.bind(skeleton, new Matrix4());
    root.add(mesh); meshes.push(mesh);
    if (mesh.userData.system === "muscles") muscles.push({ id: `mesh:${mesh.name}`, label: muscleLabel(mesh.name) });
  });
  muscles.sort((a, b) => a.label.localeCompare(b.label));
  root.scale.setScalar(0.85);
  return { root, bones, shoulderCaps, footBones, forearmBones, handBones, fingerSegments, skeleton, meshes, muscles, dispose() {
    for (const mesh of meshes) { mesh.geometry.dispose(); (mesh.material as MeshStandardMaterial).dispose(); }
    skeleton.dispose();
  } };
}

export type AnatomyRig = ReturnType<typeof createAnatomyRig>;
export function poseAnatomyRig(rig: AnatomyRig, pose: RigPose, gripping: boolean | "left" | "right" = false, forearmRotation = 90) {
  rig.root.position.set(0, 0, 0); rig.root.quaternion.identity(); rig.root.scale.setScalar(0.85);
  for (const [name, bone] of Object.entries(rig.bones)) {
    if (name.endsWith("wrist") || name.endsWith("ankle")) continue;
    const angle = pose[name as JointSlug];
    // Mirror the old mannequin's Z convention to the atlas's anatomical sides.
    // Positive elbow flexion brings the forearm toward the front (+Z).
    bone.rotation.set((angle?.x ?? 0) * Math.PI / 180 * (name.endsWith("elbow") || name.endsWith("knee") ? -1 : 1), (angle?.y ?? 0) * Math.PI / 180,
      (angle?.z ?? 0) * Math.PI / 180 * (name === "torso" ? 1 : -1));
  }
  // Rotate the forearm into a neutral grip, keeping the wrist straight.
  for (const side of ["left", "right"] as const) {
    rig.shoulderCaps[side].quaternion.identity().slerp(rig.bones[`${side}-shoulder`].quaternion, 0.82);
    const ankle = pose[`${side}-ankle`];
    rig.footBones[side].rotation.set(-(ankle?.x ?? 0) * Math.PI / 180, (ankle?.y ?? 0) * Math.PI / 180, -(ankle?.z ?? 0) * Math.PI / 180);
    const wrist = pose[`${side}-wrist`];
    if (wrist) {
      // Twist along the actual forearm so turning the palm does not move the wrist.
      rig.forearmBones[side].quaternion.setFromAxisAngle(rig.handBones[side].position.clone().normalize(),
        (side === "left" ? 1 : -1) * (wrist.x + 90) * Math.PI / 180);
    } else rig.forearmBones[side].rotation.set(0, (side === "left" ? -1 : 1) * forearmRotation * Math.PI / 180, 0);
    rig.handBones[side].rotation.set((wrist?.y ?? 0) * Math.PI / 180, 0, -(wrist?.z ?? 0) * Math.PI / 180);
  }
  for (const segment of rig.fingerSegments) {
    const close = gripping === true || gripping === segment.side;
    const bend = segment.thumb ? 45 : segment.part === "Proximal" ? 65 : segment.part === "Middle" ? 80 : 45;
    segment.bone.rotation.set(close ? -bend * Math.PI / 180 : 0, 0,
      close && segment.thumb && segment.part === "Proximal" ? (segment.side === "left" ? -1 : 1) * Math.PI / 3 : 0);
  }
  rig.root.updateMatrixWorld(true);
  rig.skeleton.update();
}

// Two-bone leg solving keeps ankle targets stationary while the pelvis moves.
// This is used only by explicitly selected authored movement styles.
export function plantAnatomyFeet(rig: AnatomyRig, style: string | undefined, pose: RigPose) {
  if (!style || style === "free") return;
  const radians = Math.PI / 180;
  const progress = Math.max(0, Math.min(1, (pose.torso?.x ?? 0) / 35));
  let lean = 0, height = 1.43, depth = 0, split = 0;
  if (style === "squat") { lean = progress * 20; height -= progress * 0.55; depth = -0.16 * progress; }
  if (style === "hinge") { lean = progress * 55; height -= progress * 0.13; depth = -0.22 * progress; }
  if (style === "row") { lean = 55; height = 1.3; depth = -0.22; }
  if (style === "split-squat") { lean = 8; height = 1.28 - progress * 0.42; split = 0.55; }
  if (style === "bench-press") { lean = -45; height = 0.84; depth = 0.35; }
  if (style === "incline-curl") { lean = -45; height = 0.88; depth = 0.35; }
  if (style === "seated-curl") { height = 0.92; }
  rig.root.rotation.x = lean * radians;
  rig.root.position.copy(new Vector3(0, height, depth).sub(new Vector3(0, 1.72, -0.07).multiplyScalar(0.85).applyQuaternion(rig.root.quaternion)));
  rig.bones.torso.rotation.x = 0;
  rig.root.updateMatrixWorld(true);
  for (const side of ["left", "right"] as const) {
    const hip = rig.bones[`${side}-hip`], knee = rig.bones[`${side}-knee`];
    const rearFoot = style === "split-squat" && side === "right";
    const worldTarget = new Vector3(side === "left" ? 0.153 : -0.153, rearFoot ? 0.204 : 0.119,
      style === "seated-curl" ? 0.85 : style === "bench-press" || style === "incline-curl" ? 0.95 : (side === "left" ? split : -split) - 0.034);
    const target = rig.root.worldToLocal(worldTarget.clone());
    const origin = new Vector3(...pivots[`${side}-hip`]);
    const dy = target.y - origin.y, dz = target.z - origin.z;
    const upper = Math.hypot(0.93, 0.03), lower = 0.65;
    const distance = Math.min(upper + lower - 0.0001, Math.max(Math.abs(upper - lower) + 0.0001, Math.hypot(dy, dz)));
    const bearing = Math.atan2(dz, -dy);
    const opening = Math.acos(Math.max(-1, Math.min(1, (upper * upper + distance * distance - lower * lower) / (2 * upper * distance))));
    hip.rotation.set(-bearing - opening + Math.atan2(0.03, 0.93), 0, 0);
    knee.rotation.set(Math.PI - Math.acos(Math.max(-1, Math.min(1, (upper * upper + lower * lower - distance * distance) / (2 * upper * lower)))) - Math.atan2(0.03, 0.93), 0, 0);
    rig.root.updateMatrixWorld(true);
    const ankleRotation = rig.footBones[side].quaternion.clone();
    rig.footBones[side].quaternion.copy(knee.getWorldQuaternion(new Quaternion()).invert());
    if (rearFoot) rig.footBones[side].quaternion.multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), 25 * radians));
    if (pose[`${side}-ankle`]) rig.footBones[side].quaternion.multiply(ankleRotation);
  }
  rig.root.updateMatrixWorld(true); rig.skeleton.update();
}

/** Place a gripped weight using a two-segment arm and an outward elbow pole. */
function reachWithGrip(rig: AnatomyRig, side: "left" | "right", target: Vector3) {
  const shoulder = rig.bones[`${side}-shoulder`], elbow = rig.bones[`${side}-elbow`];
  const sign = side === "left" ? 1 : -1;
  const upperRest = elbow.position.clone();
  const gripOffset = new Vector3(sign * 0.03, -0.15, 0.13);
  const reachTarget = target;
  const lowerRest = rig.handBones[side].position.clone().add(gripOffset);
  lowerRest.applyQuaternion(rig.forearmBones[side].quaternion);
  const origin = shoulder.getWorldPosition(new Vector3());
  const upper = upperRest.length() * 0.85, lower = lowerRest.length() * 0.85;
  const direction = reachTarget.clone().sub(origin);
  const distance = Math.min(direction.length(), upper + lower - 0.001);
  direction.normalize();
  const along = (upper * upper - lower * lower + distance * distance) / (2 * distance);
  const pole = new Vector3(sign, -0.25, 0);
  pole.addScaledVector(direction, -pole.dot(direction)).normalize();
  const elbowTarget = origin.clone().addScaledVector(direction, along)
    .addScaledVector(pole, Math.sqrt(Math.max(0, upper * upper - along * along)));
  const parentRotation = shoulder.parent!.getWorldQuaternion(new Quaternion()).invert();
  shoulder.quaternion.setFromUnitVectors(upperRest.clone().normalize(), elbowTarget.clone().sub(origin).normalize().applyQuaternion(parentRotation));
  rig.root.updateMatrixWorld(true);
  const shoulderInverse = shoulder.getWorldQuaternion(new Quaternion()).invert();
  elbow.quaternion.setFromUnitVectors(lowerRest.normalize(), reachTarget.clone().sub(elbowTarget).normalize().applyQuaternion(shoulderInverse));
  rig.shoulderCaps[side].quaternion.identity().slerp(shoulder.quaternion, 0.82);
  rig.root.updateMatrixWorld(true);
}

function pressWithStraightWrist(rig: AnatomyRig, side: "left" | "right", progress: number) {
  const sign = side === "left" ? 1 : -1;
  const shoulder = rig.bones[`${side}-shoulder`], elbow = rig.bones[`${side}-elbow`];
  const forearm = rig.forearmBones[side], hand = rig.handBones[side];
  const fixedGrip = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI);
  const lowerOffset = hand.position.clone().add(new Vector3(sign * 0.03, -0.15, 0.13))
    .applyQuaternion(fixedGrip).multiplyScalar(0.85);
  // Solve the elbow on the upper-arm sphere. The forearm and hand then move
  // together at a fixed orientation, with no compensating wrist bend.
  const dy = 0.16 + 0.84 * progress - lowerOffset.y;
  const dz = 0.08 - lowerOffset.z;
  const upperLength = elbow.position.length() * 0.85;
  const dx = sign * Math.sqrt(Math.max(0, upperLength * upperLength - dy * dy - dz * dz));
  const direction = new Vector3(dx, dy, dz).normalize()
    .applyQuaternion(shoulder.parent!.getWorldQuaternion(new Quaternion()).invert());
  shoulder.quaternion.setFromUnitVectors(elbow.position.clone().normalize(), direction);
  rig.root.updateMatrixWorld(true);
  elbow.quaternion.copy(shoulder.getWorldQuaternion(new Quaternion()).invert())
    .multiply(fixedGrip).multiply(forearm.quaternion.clone().invert());
  hand.quaternion.identity();
  rig.shoulderCaps[side].quaternion.identity().slerp(shoulder.quaternion, 0.82);
  rig.root.updateMatrixWorld(true);
}

export function correctAuthoredArmPath(rig: AnatomyRig, style: string | undefined, pose: RigPose) {
  if (style !== "bench-press" && style !== "split-squat") return;
  for (const side of ["left", "right"] as const) {
    const sign = side === "left" ? 1 : -1;
    const shoulder = rig.bones[`${side}-shoulder`].getWorldPosition(new Vector3());
    if (style === "bench-press") {
      const progress = Math.max(0, Math.min(1, (90 - (pose[`${side}-elbow`]?.x ?? 90)) / 85));
      // Gravity stays vertical even though the torso is reclined on the bench.
      pressWithStraightWrist(rig, side, progress);
    } else {
      // Keep the entire weight outside the pelvis and moving front thigh.
      reachWithGrip(rig, side, new Vector3(sign * 0.44, shoulder.y - 1.01, shoulder.z + 0.03));
    }
  }
  rig.skeleton.update();
}

export function highlightAnatomyRig(rig: AnatomyRig, target: string, isolate: boolean) {
  const group = muscleGroups.find(item => target === `group:${item.id}`);
  let count = 0;
  for (const mesh of rig.meshes) {
    const selected = mesh.userData.system === "muscles"
      && (target === `mesh:${mesh.name}` || Boolean(group?.pattern.test(mesh.name.toLowerCase())));
    mesh.visible = !isolate || target === "none" || selected;
    (mesh.material as MeshStandardMaterial).color.set(selected ? "#c33d36" : mesh.userData.system === "skeleton" ? "#ddd8cb" : "#8e9994");
    if (selected) count++;
  }
  return count;
}
