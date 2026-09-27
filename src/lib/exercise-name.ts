/** Normalizes names for exact duplicate candidates; it does not decide equivalence. */
export function normalizeExerciseName(name: string): string {
  return name
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}
