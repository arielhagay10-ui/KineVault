import { popularWorkshopEquipment, type EquipmentOption, type EquipmentPreferences } from "./quick-create";

/** Each visible option belongs to the first applicable section. */
export function workshopEquipmentSections(options: EquipmentOption[], preferences: EquipmentPreferences, searching: boolean) {
  const available = new Map(options.map(option => [option.slug, option]));
  const take = (slugs: readonly string[]) => slugs.flatMap(slug => {
    const option = available.get(slug);
    if (!option) return [];
    available.delete(slug);
    return [option];
  });
  const essentials = searching ? [] : take(popularWorkshopEquipment);
  const recent = searching ? [] : take(preferences.recent);
  const favorites = take(preferences.favorites);
  return { essentials, recent, favorites, catalog: [...available.values()] };
}
