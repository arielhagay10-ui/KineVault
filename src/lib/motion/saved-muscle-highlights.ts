// Catalog slugs map to exact Z-Anatomy structures, including separate deltoid heads.
const patterns = new Map<string, RegExp>([
  ["anterior-deltoid", /clavicular_part_of_deltoid/],
  ["lateral-deltoid", /acromial_part_of_deltoid/],
  ["posterior-deltoid", /scapular_spinal_part_of_deltoid/],
  ["biceps-brachii", /biceps_brachii/],
  ["brachialis", /brachialis/],
  ["triceps-brachii", /triceps_brachii/],
  ["trapezius", /trapezius/],
  ["pectoralis-major", /pectoralis_major/],
  ["latissimus-dorsi", /latissimus_dorsi/],
  ["gluteus-maximus", /gluteus_maximus/],
  ["quadriceps", /rectus_femoris|vastus_(medialis|lateralis|intermedius)/],
  ["hamstrings", /biceps_femoris|semitendinosus|semimembranosus/],
  ["gastrocnemius", /gastrocnemius/],
  ["soleus", /soleus/],
  ["erector-spinae", /iliocostalis|longissimus|(?:^|_)spinalis/],
]);

export function savedMuscleHighlight(slugs: readonly string[], secondarySlugs: readonly string[] = []): string {
  const secondary = new Set(secondarySlugs);
  const mapped = [...new Set(slugs.filter(slug => patterns.has(slug)))].sort();
  return mapped.length ? `saved:${mapped.map(slug => secondary.has(slug) ? `${slug}:secondary` : slug).join(",")}` : "none";
}

export function savedMusclePatterns(target: string, role?: "primary" | "secondary"): RegExp[] {
  if (!target.startsWith("saved:")) return [];
  return target.slice(6).split(",").flatMap(entry => {
    const [slug, savedRole] = entry.split(":");
    if (role && (savedRole === "secondary") !== (role === "secondary")) return [];
    const pattern = patterns.get(slug);
    return pattern ? [pattern] : [];
  });
}

export function savedMuscleHighlightLabel(target: string): string | undefined {
  return savedMusclePatterns(target).length ? "Saved working muscles" : undefined;
}
