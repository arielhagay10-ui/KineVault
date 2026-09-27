import { z } from "zod";

export type RawSearchParams = Record<string, string | string[] | undefined>;
export type ExploreSort = "alphabetical" | "newest" | "most_favorited";

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const slugs = z.array(slug).max(20);
const sort = z.enum(["alphabetical", "newest", "most_favorited"]);
const filters = z.object({
  query: z.string().max(100),
  muscles: slugs,
  primaryMuscles: slugs,
  secondaryMuscles: slugs,
  stabilizerMuscles: slugs,
  joints: slugs,
  jointActions: slugs,
  families: slugs,
  movementPatterns: slugs,
  planes: slugs,
  mechanics: z.array(z.enum(["compound", "isolation"])).max(20),
  forceTypes: z.array(z.enum(["push", "pull", "static", "mixed"])).max(20),
  lateralities: z.array(z.enum(["unilateral", "bilateral", "alternating"])).max(20),
  equipmentCategories: slugs,
  equipment: slugs,
  attachments: slugs,
  resistanceSources: slugs,
  resistanceProfiles: z.array(z.enum([
    "ascending", "descending", "bell_shaped", "relatively_constant",
    "variable_complex", "unknown",
  ])).max(20),
  peakPositions: z.array(z.enum(["beginning", "middle", "end", "multiple", "unknown"])).max(20),
  bodyPositions: slugs,
  difficulties: z.array(z.enum(["beginner", "intermediate", "advanced"])).max(20),
  sort,
});
const cursorSchema = z.object({
  sort,
  id: z.uuid(),
  name: z.string().optional(),
  publishedAt: z.iso.datetime({ offset: true }).optional(),
  favoriteCount: z.number().int().nonnegative().optional(),
});

export type ExploreCursor = z.infer<typeof cursorSchema>;
export type ExploreParams = z.infer<typeof filters> & { cursor: ExploreCursor | null };

export const filterParamNames = [
  ["muscles", "muscle"],
  ["primaryMuscles", "primaryMuscle"],
  ["secondaryMuscles", "secondaryMuscle"],
  ["stabilizerMuscles", "stabilizerMuscle"],
  ["joints", "joint"],
  ["jointActions", "jointAction"],
  ["families", "family"],
  ["movementPatterns", "movementPattern"],
  ["planes", "plane"],
  ["mechanics", "mechanic"],
  ["forceTypes", "forceType"],
  ["lateralities", "laterality"],
  ["equipmentCategories", "equipmentCategory"],
  ["equipment", "equipment"],
  ["attachments", "attachment"],
  ["resistanceSources", "resistanceSource"],
  ["resistanceProfiles", "resistanceProfile"],
  ["peakPositions", "peakPosition"],
  ["bodyPositions", "bodyPosition"],
  ["difficulties", "difficulty"],
] as const;

function first(value: RawSearchParams[string]): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function list(value: RawSearchParams[string]): string[] {
  const values = value === undefined ? [] : Array.isArray(value) ? value : [value];
  return [...new Set(values)];
}

export function encodeCursor(cursor: ExploreCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export function parseExploreParams(raw: RawSearchParams): ExploreParams | null {
  const input: Record<string, unknown> = {
    query: first(raw.q) ?? "",
    sort: first(raw.sort) ?? "alphabetical",
  };
  for (const [field, paramName] of filterParamNames) input[field] = list(raw[paramName]);
  const parsed = filters.safeParse(input);
  if (!parsed.success) return null;

  let cursor: ExploreCursor | null = null;
  const rawCursor = first(raw.cursor);
  if (rawCursor) {
    if (rawCursor.length > 500) return null;
    try {
      const decoded: unknown = JSON.parse(Buffer.from(rawCursor, "base64url").toString("utf8"));
      const result = cursorSchema.safeParse(decoded);
      if (!result.success || result.data.sort !== parsed.data.sort) return null;
      if (result.data.sort === "alphabetical" && result.data.name === undefined) return null;
      if (result.data.sort === "newest" && result.data.publishedAt === undefined) return null;
      if (result.data.sort === "most_favorited" && result.data.favoriteCount === undefined) return null;
      cursor = result.data;
    } catch {
      return null;
    }
  }

  return { ...parsed.data, query: parsed.data.query.trim(), cursor };
}

export function nextPageUrl(params: ExploreParams, cursor: ExploreCursor): string {
  const query = new URLSearchParams();
  if (params.query) query.set("q", params.query);
  for (const [field, name] of filterParamNames) {
    for (const value of params[field]) query.append(name, value);
  }
  if (params.sort !== "alphabetical") query.set("sort", params.sort);
  query.set("cursor", encodeCursor(cursor));
  return `/exercises?${query.toString()}`;
}
