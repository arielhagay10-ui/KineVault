/** Static picker paths; intentionally free of Three.js and motion imports. */
const equipmentSlugs = new Set([
  "cable-machine", "bench", "squat-rack", "barbell", "dumbbell", "kettlebell",
  "lat-pulldown-machine", "smith-machine", "leg-press", "cable-row-machine", "pec-deck",
  "row-machine", "t-bar-row-machine", "shoulder-press-machine", "chest-press-machine", "stool", "plyo-box", "resistance-band",
  "attachment-d-handle", "attachment-rope", "attachment-straight-bar",
  "attachment-angled-bar", "attachment-lat-bar", "attachment-v-bar", "attachment-cuff",
]);

export function equipmentThumbnail(slug: string): string | undefined {
  return equipmentSlugs.has(slug) ? `/models/equipment/thumbnails/${slug}.webp` : undefined;
}
