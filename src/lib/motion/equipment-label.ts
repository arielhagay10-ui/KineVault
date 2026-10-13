import type { StudioObject } from "./workshop";

export function equipmentLabel(objects: StudioObject[], object: StudioObject): string {
  const siblings = objects.filter(item => item.slug === object.slug);
  return siblings.length > 1 ? `${object.name} ${siblings.findIndex(item => item.id === object.id) + 1}` : object.name;
}
