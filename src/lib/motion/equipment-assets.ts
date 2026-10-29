import { Material, Mesh, Object3D, Texture, Vector3 } from "three";
import { machineCarriagePoint, machineLever } from "./studio-machines";
import { chestPressLever } from "./chest-press";
import { shoulderPressLever } from "./shoulder-press";
import type { CableAttachment, StudioObject } from "./workshop";

/** Internal renderer contract in solver metres/Y-up. All meshes are original. */
export const equipmentAssets = {
  "chest-press-machine": { url: "/models/equipment/chest-press-machine.v1.glb", requiredGroups: ["Static", "Weights", "Handles", "LeftLever", "RightLever", "LeftNeutralGrip", "RightNeutralGrip"] },
  "lat-pulldown-machine": { url: "/models/equipment/lat-pulldown.v1.glb", requiredGroups: ["Static", "Weights", "Handles"] },
  "smith-machine": { url: "/models/equipment/smith-machine.v1.glb", requiredGroups: ["Static", "Weights", "Handles"] },
  "leg-press": { url: "/models/equipment/leg-press.v2.glb", requiredGroups: ["Static", "Weights", "Handles"] },
  "cable-row-machine": { url: "/models/equipment/cable-row-machine.v1.glb", requiredGroups: ["Static", "Weights", "Handles"] },
  "pec-deck": { url: "/models/equipment/pec-deck.v1.glb", requiredGroups: ["Static", "Weights", "Handles", "LeftArm", "RightArm"] },
  "cable-machine": { url: "/models/equipment/cable-machine.v1.glb", requiredGroups: ["Static", "Pulley"] },
  bench: { url: "/models/equipment/bench.v1.glb", requiredGroups: ["Static", "Back", "Brace"] },
  "squat-rack": { url: "/models/equipment/squat-rack.v1.glb", requiredGroups: ["Static"] },
  barbell: { url: "/models/equipment/barbell.v1.glb", requiredGroups: ["Static"] },
  dumbbell: { url: "/models/equipment/dumbbell.v1.glb", requiredGroups: ["Static"] },
  kettlebell: { url: "/models/equipment/kettlebell.v1.glb", requiredGroups: ["Static"] },
  "row-machine": { url: "/models/equipment/row-machine.v3.glb", requiredGroups: ["Static", "Weights", "Handles", "Seat", "LeftLever", "RightLever"] },
  "t-bar-row-machine": { url: "/models/equipment/t-bar-row-machine.v1.glb", requiredGroups: ["Static", "Lever"] },
  "shoulder-press-machine": { url: "/models/equipment/shoulder-press-machine.v2.glb", requiredGroups: ["Static", "Weights", "Handles", "LeftLever", "RightLever", "LeftNeutralGrip", "RightNeutralGrip"] },
  stool: { url: "/models/equipment/stool.v1.glb", requiredGroups: ["Static"] },
  "plyo-box": { url: "/models/equipment/plyo-box.v1.glb", requiredGroups: ["Static"] },
  "resistance-band": { url: "/models/equipment/resistance-band.v1.glb", requiredGroups: ["Static"] },
} as const satisfies Record<StudioObject["slug"], { url: string; requiredGroups: readonly string[] }>;

export const attachmentAssets = {
  "d-handle": { url: "/models/equipment/attachment-d-handle.v1.glb", requiredGroups: ["Static"] },
  rope: { url: "/models/equipment/attachment-rope.v1.glb", requiredGroups: ["Static"] },
  "straight-bar": { url: "/models/equipment/attachment-straight-bar.v1.glb", requiredGroups: ["Static"] },
  "angled-bar": { url: "/models/equipment/attachment-angled-bar.v1.glb", requiredGroups: ["Static"] },
  "lat-bar": { url: "/models/equipment/attachment-lat-bar.v1.glb", requiredGroups: ["Static"] },
  "v-bar": { url: "/models/equipment/attachment-v-bar.v1.glb", requiredGroups: ["Static"] },
  cuff: { url: "/models/equipment/attachment-cuff.v1.glb", requiredGroups: ["Static"] },
} as const satisfies Record<CableAttachment, { url: string; requiredGroups: readonly string[] }>;

export type EquipmentAssetDefinition = { url: string; requiredGroups: readonly string[] };
export type EquipmentAssetInstance = { root: Object3D; groups: Record<string, Object3D> };

const braceDirection = new Vector3();
const xAxis = new Vector3(1, 0, 0);
const yAxis = new Vector3(0, 1, 0);

export function updateCableAttachmentScale(root: Object3D, kind: CableAttachment, cuffRadius: number) {
  if (kind === "cuff") root.scale.set(cuffRadius, .22, cuffRadius);
  else root.scale.setScalar(1);
}

export function equipmentAssetsSettled(objects: readonly StudioObject[], settled: Readonly<Record<string, boolean>>) {
  const assets = objects.filter(object => object.slug in equipmentAssets);
  return !assets.length || (settled["studio-lighting"] === true && assets.every(object =>
    settled[object.id] === true && (!(object.slug === "cable-machine" || object.cableAttachment) ||
      (object.cableAttachment === "rope" ? ["left", "right"].every(side => settled[`attachment:${object.id}:${side}`] === true)
        : settled[`attachment:${object.id}:primary`] === true))));
}

export function createEquipmentAssetInstance(source: Object3D, definition: EquipmentAssetDefinition): EquipmentAssetInstance {
  for (const name of definition.requiredGroups) {
    const matches: Object3D[] = [];
    source.traverse(node => { if (node.name === name) matches.push(node); });
    if (matches.length !== 1) throw new Error(`Equipment asset needs exactly one ${name} group.`);
  }
  const root = source.clone(true);
  root.traverse(node => {
    if (!(node instanceof Mesh)) return;
    node.geometry = node.geometry.clone();
    const copy = (material: Material) => {
      const owned = material.clone();
      for (const [key, value] of Object.entries(owned)) {
        if (value instanceof Texture) (owned as unknown as Record<string, unknown>)[key] = value.clone();
      }
      return owned;
    };
    node.material = Array.isArray(node.material) ? node.material.map(copy) : copy(node.material);
    node.castShadow = true; node.receiveShadow = true;
  });
  return { root, groups: Object.fromEntries(definition.requiredGroups.map(name => [name, root.getObjectByName(name)!])) };
}

export function updateEquipmentAsset(instance: EquipmentAssetInstance, object: StudioObject) {
  const { groups } = instance;
  const travel = object.machinePosition ?? .5;
  if (groups.Lever) {
    const lever = machineLever(object, "left");
    groups.Lever.position.copy(lever.pivot); groups.Lever.rotation.x = lever.angle;
  }
  if (object.slug === "row-machine" && groups.Seat) groups.Seat.position.y = (object.rowSeatHeight ?? .66) - .66;
  if (object.slug === "resistance-band") groups.Static.visible = false;
  if (groups.LeftLever && groups.RightLever) {
    for (const [side, node] of [["left", groups.LeftLever], ["right", groups.RightLever]] as const) {
      const lever = machineLever(object, side);
      node.position.copy(lever.pivot);
      if (object.slug === "chest-press-machine") node.quaternion.setFromAxisAngle(chestPressLever(object, side).axis, lever.angle);
      else if (object.slug === "shoulder-press-machine") node.quaternion.setFromAxisAngle(shoulderPressLever(object, side).axis, lever.angle);
      else node.rotation.x = lever.angle;
      const swivel = groups[side === "left" ? "LeftNeutralGrip" : "RightNeutralGrip"];
      if (swivel) swivel.quaternion.copy(node.quaternion).invert();
    }
  }
  if (groups.Handles) {
    groups.Handles.position.copy(machineCarriagePoint(object));
    groups.Handles.visible = object.slug !== "cable-row-machine" || !object.cableAttachment;
  }
  if (groups.Weights) {
    const distance = ({ "lat-pulldown-machine": .98, "cable-row-machine": .66, "pec-deck": .4 } as Record<string, number>)[object.slug] ?? 0;
    groups.Weights.position.y = object.slug === "chest-press-machine"
      ? Math.max(object.machinePositionLeft ?? travel, object.machinePositionRight ?? travel) * .26 : travel * distance;
  }
  if (groups.Pulley) groups.Pulley.position.y = object.pulleyHeight;
  if (groups.Back) {
    groups.Back.position.set(0, .673, .253);
    groups.Back.rotation.x = Math.max(0, Math.min(85, object.benchAngle ?? 45)) * Math.PI / 180;
    if (groups.Brace) {
      groups.Brace.position.set(0, .28, -.5);
      braceDirection.set(0, -.08, -.92).applyAxisAngle(xAxis, groups.Back.rotation.x)
        .add(groups.Back.position).sub(groups.Brace.position);
      groups.Brace.scale.y = braceDirection.length();
      groups.Brace.quaternion.setFromUnitVectors(yAxis, braceDirection.normalize());
    }
  }
  if (groups.LeftArm && groups.RightArm) {
    const reverse = object.machineMode === "reverse";
    const angle = ((reverse ? -9 + 89 * travel : 80 - 89 * travel) * Math.PI / 180);
    for (const [side, node] of [["left", groups.LeftArm], ["right", groups.RightArm]] as const) {
      const sign = side === "left" ? 1 : -1;
      node.position.set(sign * (reverse ? -.289 : .289), 2.62, reverse ? .136 : 0);
      node.rotation.y = reverse ? Math.PI + sign * angle : sign * angle;
    }
  }
}

/** Loaded roots and clones own their resources; call once when released. */
export function disposeEquipmentAsset(root: Object3D) {
  const resources = new Set<{ dispose: () => void }>();
  root.traverse(node => {
    if (!(node instanceof Mesh)) return;
    resources.add(node.geometry);
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      resources.add(material);
      for (const value of Object.values(material)) if (value instanceof Texture) resources.add(value);
    }
  });
  for (const resource of resources) resource.dispose();
}
