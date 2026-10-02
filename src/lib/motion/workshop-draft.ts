import { z } from "zod";
import { workshopSceneSchema } from "./scene-schema";
import type { WorkshopScene } from "./workshop";

export const draftRecoveryKey = (ownerId: string, privateId: string | null) => `kinevault.workshop.draft.${ownerId}.${privateId ?? "new"}`;
const recoverySchema = z.object({ scene: workshopSceneSchema, name: z.string().max(200), privateId: z.string().nullable(), confirmed: z.boolean().optional(), sessionId: z.string().optional(), updatedAt: z.number().finite() });
export type DraftRecovery = Omit<z.infer<typeof recoverySchema>, "scene"> & { scene: WorkshopScene };
export function parseDraftRecovery(value: string | null): DraftRecovery | null {
  try { const result = recoverySchema.safeParse(JSON.parse(value ?? "null")); return result.success ? result.data : null; } catch { return null; }
}
export type DraftSaveResult = { error: string | null; privateId?: string; current?: boolean };
type RecoveryStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export const draftSnapshot = (value: Pick<DraftRecovery, "scene" | "name">) => {
  const parsed = workshopSceneSchema.safeParse(value.scene);
  return JSON.stringify({ scene: parsed.success ? parsed.data : value.scene, name: value.name });
};
/** Write the destination before removing the old key. A failed write keeps the original. */
export function migrateDraftRecovery(storage: RecoveryStorage, from: string, to: string, value: DraftRecovery) {
  storage.setItem(to, JSON.stringify(value));
  if (from !== to) storage.removeItem(from);
}
export function clearMatchingRecovery(storage: RecoveryStorage, key: string, snapshot: string) {
  const stored = parseDraftRecovery(storage.getItem(key));
  if (stored && draftSnapshot(stored) === snapshot) storage.removeItem(key);
}
/** An uncertain first request remains resumable at both the new route and its UUID. */
export function persistDraftRecovery(storage: RecoveryStorage, ownerId: string, key: string, value: DraftRecovery) {
  const idKey = value.privateId ? draftRecoveryKey(ownerId, value.privateId) : key;
  const newKey = draftRecoveryKey(ownerId, null);
  const previous = parseDraftRecovery(storage.getItem(idKey));
  const alias = parseDraftRecovery(storage.getItem(newKey));
  storage.setItem(idKey, JSON.stringify(value));
  if (key !== idKey) storage.setItem(key, JSON.stringify(value));
  else if (newKey !== idKey && alias?.privateId === value.privateId && (alias.sessionId === previous?.sessionId || alias.sessionId === value.sessionId)) storage.setItem(newKey, JSON.stringify(value));
}
export function readDraftRecovery(storage: RecoveryStorage, ownerId: string, privateId: string | null) {
  const primary = parseDraftRecovery(storage.getItem(draftRecoveryKey(ownerId, privateId)));
  const alternate = parseDraftRecovery(storage.getItem(draftRecoveryKey(ownerId, privateId ? null : primary?.privateId ?? null)));
  if (alternate?.privateId && alternate.privateId === (privateId ?? primary?.privateId) && (!primary || alternate.updatedAt > primary.updatedAt || (!privateId && alternate.updatedAt === primary.updatedAt))) return alternate;
  return primary;
}
/** A completion may only maintain records owned by its still-active editor. */
export function confirmDraftRecovery(storage: RecoveryStorage, from: string, to: string, value: DraftRecovery, active: boolean, clearSaved: boolean, ownerId?: string) {
  if (!active || !value.sessionId) return false;
  for (const key of new Set([from, to])) {
    const stored = parseDraftRecovery(storage.getItem(key));
    if (stored && stored.sessionId !== value.sessionId) return false;
  }
  migrateDraftRecovery(storage, from, to, value);
  if (clearSaved) clearMatchingRecovery(storage, to, draftSnapshot(value));
  if (ownerId && value.privateId) {
    const aliasKey = draftRecoveryKey(ownerId, null);
    const alias = parseDraftRecovery(storage.getItem(aliasKey));
    if (aliasKey !== to && alias?.privateId === value.privateId && alias.sessionId === value.sessionId) storage.removeItem(aliasKey);
  }
  return true;
}
export function removeOwnedDraftRecovery(storage: RecoveryStorage, key: string, sessionId: string, ownerId?: string) {
  const stored = parseDraftRecovery(storage.getItem(key));
  if (stored?.sessionId === sessionId) {
    storage.removeItem(key);
    if (ownerId && stored.privateId) clearDraftRecoveryCopies(storage, ownerId, stored.privateId, draftSnapshot(stored), sessionId);
  }
}
export function clearDraftRecoveryCopies(storage: RecoveryStorage, ownerId: string, privateId: string | null, snapshot: string, sessionId?: string) {
  for (const key of new Set([draftRecoveryKey(ownerId, privateId), draftRecoveryKey(ownerId, null)])) {
    const stored = parseDraftRecovery(storage.getItem(key));
    if (stored?.privateId === privateId && draftSnapshot(stored) === snapshot && (!sessionId || stored.sessionId === sessionId)) storage.removeItem(key);
  }
}
export class DraftSaveQueue {
  private tail: Promise<unknown> = Promise.resolve();
  private createIfMissing: boolean;
  constructor(public privateId: string | null, private readonly write: (id: string | null, scene: WorkshopScene, name: string, createIfMissing: boolean) => Promise<DraftSaveResult>) { this.createIfMissing = privateId === null; }
  get confirmed() { return !this.createIfMissing; }
  prepareId() { return this.privateId ??= crypto.randomUUID(); }
  restoreId(id: string, confirmed = true) { this.privateId = id; this.createIfMissing = !confirmed; }
  save(scene: WorkshopScene, name: string): Promise<DraftSaveResult> {
    const next = this.tail.then(async () => {
      try {
        const result = await this.write(this.prepareId(), scene, name, this.createIfMissing);
        if (!result.error && result.privateId) { this.privateId = result.privateId; this.createIfMissing = false; }
        return result;
      } catch { return { error: "Check your connection, then Retry. Your draft is still here." }; }
    });
    this.tail = next;
    return next;
  }
}
