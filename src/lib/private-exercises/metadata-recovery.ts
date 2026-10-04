import { z } from "zod";
import { parsePrivateExerciseForm, parsePrivateMetadata } from "./schema";
import type { ReviewPatch } from "@/lib/moderation/schema";

const recoverySchema = z.object({ baseline: z.string().max(100000),
  values: z.array(z.tuple([z.string().max(200), z.string().max(20000)])).max(2000), updatedAt: z.number().finite() });

export function readMetadataRecovery(raw: string | null, privateId: string | null, now = Date.now()) {
  if (!raw || raw.length > 200000) return null;
  try {
    const stored = recoverySchema.parse(JSON.parse(raw));
    if (now - stored.updatedAt > 7 * 86400000 || stored.updatedAt > now) return null;
    const data = new FormData();
    for (const [name, value] of stored.values) data.append(name, value);
    const parsed = parsePrivateExerciseForm(data, true);
    if (!parsed.success || parsed.data.privateId !== privateId) return null;
    const metadata = parsePrivateMetadata(data, parsed.data, true);
    return metadata.success ? { initial: parsed.data, metadata: metadata.data, baseline: stored.baseline } : null;
  } catch { return null; }
}

export type MetadataRecovery = NonNullable<ReturnType<typeof readMetadataRecovery>>;

/** Taxonomy/alias ordering and object property ordering are not metadata edits. */
export function sameMetadata(left: unknown, right: unknown): boolean {
  const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonical).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
    return value;
  };
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
}

export function matchesSavedMetadata(draft: ReviewPatch, saved: ReviewPatch | undefined): boolean {
  if (!saved) return false;
  // Save derives parent joints from selected actions. These additions are persisted data.
  const { joints: draftJoints, ...draftFields } = draft;
  const { joints: savedJoints, ...savedFields } = saved;
  return sameMetadata(draftFields, savedFields) && draftJoints.every(joint => savedJoints.some(item => sameMetadata(item, joint)));
}
