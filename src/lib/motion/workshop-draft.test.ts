import { describe, expect, it } from "vitest";
import { blankWorkshopScene } from "./workshop";
import { DraftSaveQueue, clearDraftRecoveryCopies, clearMatchingRecovery, confirmDraftRecovery, draftSnapshot, migrateDraftRecovery, parseDraftRecovery, persistDraftRecovery, readDraftRecovery, removeOwnedDraftRecovery, draftRecoveryKey } from "./workshop-draft";

describe("private workshop recovery", () => {
  it("isolates accounts and validates recovery rather than trusting stored JSON", () => {
    expect(draftRecoveryKey("a", "draft")).not.toBe(draftRecoveryKey("b", "draft"));
    expect(parseDraftRecovery('{"scene":{}}')).toBeNull();
    expect(parseDraftRecovery(JSON.stringify({ scene: blankWorkshopScene, name: "Row", privateId: null, updatedAt: 3 }))).toMatchObject({ name: "Row" });
  });
  it("serializes saves, propagates created ID and never marks newer edits saved", async () => {
    let release!: () => void;
    const calls: (string | null)[] = [];
    const queue = new DraftSaveQueue(null, async id => {
      calls.push(id);
      if (calls.length === 1) await new Promise<void>(resolve => { release = resolve; });
      return { error: null, privateId: "created" };
    });
    const first = queue.save(blankWorkshopScene, "First");
    const second = queue.save(blankWorkshopScene, "Newer");
    await Promise.resolve();
    const requestId = calls[0];
    expect(requestId).toMatch(/^[a-f0-9-]{36}$/);
    release();
    await Promise.all([first, second]);
    expect(calls).toEqual([requestId, "created"]);
    expect(queue.privateId).toBe("created");
  });
  it("reuses a persisted first-save ID after a lost response and reload", async () => {
    const requests: { id: string | null; create: boolean }[] = [];
    const committed = new Set<string>();
    const write = async (id: string | null, _scene: typeof blankWorkshopScene, _name: string, create: boolean) => {
      requests.push({ id, create }); committed.add(id!);
      if (requests.length === 1) throw new Error("Response lost after commit");
      return { error: null, privateId: id! };
    };
    const queue = new DraftSaveQueue(null, write);
    const persisted = JSON.stringify({ scene: blankWorkshopScene, name: "Row", privateId: queue.prepareId(), confirmed: queue.confirmed, updatedAt: 4 });
    await queue.save(blankWorkshopScene, "Row");
    const recovered = parseDraftRecovery(persisted)!;
    const reloaded = new DraftSaveQueue(null, write);
    reloaded.restoreId(recovered.privateId!, recovered.confirmed);
    expect((await reloaded.save(recovered.scene, recovered.name)).error).toBeNull();
    expect(committed.size).toBe(1);
    expect(requests[0]).toEqual(requests[1]);
    expect(reloaded.confirmed).toBe(true);
  });
  it("moves the newest in-flight edit to the saved route before removing new recovery", () => {
    const records = new Map<string, string>();
    const storage = { getItem: (key: string) => records.get(key) ?? null, setItem: (key: string, value: string) => { records.set(key, value); }, removeItem: (key: string) => { records.delete(key); } };
    const from = draftRecoveryKey("owner", null), to = draftRecoveryKey("owner", "id");
    const first = { scene: blankWorkshopScene, name: "First", privateId: "id", updatedAt: 1 };
    const newer = { ...first, name: "Newer", confirmed: true, updatedAt: 2 };
    storage.setItem(from, JSON.stringify(newer));
    migrateDraftRecovery(storage, from, to, newer);
    clearMatchingRecovery(storage, to, draftSnapshot(first));
    expect(records.has(from)).toBe(false);
    expect(parseDraftRecovery(storage.getItem(to))?.name).toBe("Newer");
    clearMatchingRecovery(storage, to, draftSnapshot(newer));
    expect(records.has(to)).toBe(false);
  });
  it("retains the old recovery if migration storage fails", () => {
    const value = { scene: blankWorkshopScene, name: "Row", privateId: "id", updatedAt: 1 };
    let removed = false;
    const storage = { getItem: () => JSON.stringify(value), setItem: () => { throw new Error("quota"); }, removeItem: () => { removed = true; } };
    expect(() => migrateDraftRecovery(storage, "new", "id", value)).toThrow("quota");
    expect(removed).toBe(false);
  });
  it("a delayed old-session response cannot overwrite or clear a resumed editor's offline copy", async () => {
    const records = new Map<string, string>();
    const storage = { getItem: (key: string) => records.get(key) ?? null, setItem: (key: string, value: string) => { records.set(key, value); }, removeItem: (key: string) => { records.delete(key); } };
    const key = draftRecoveryKey("owner", "id");
    const old = { scene: blankWorkshopScene, name: "Save A", privateId: "id", confirmed: true, sessionId: "old", updatedAt: 1 };
    persistDraftRecovery(storage, "owner", key, old);
    let release!: () => void;
    let active = true;
    const completion = new Promise<void>(resolve => { release = resolve; }).then(() => confirmDraftRecovery(storage, key, key, old, active, true));
    active = false;
    const newer = { ...old, name: "Offline B", sessionId: "resumed", updatedAt: 2 };
    persistDraftRecovery(storage, "owner", key, newer);
    release();
    expect(await completion).toBe(false);
    expect(readDraftRecovery(storage, "owner", "id")?.name).toBe("Offline B");
    // A mounted but superseded session also cannot clear another session's copy.
    expect(confirmDraftRecovery(storage, key, key, old, true, true)).toBe(false);
    removeOwnedDraftRecovery(storage, key, "old");
    expect(readDraftRecovery(storage, "owner", "id")?.name).toBe("Offline B");
  });
  it("first-save identity and recovery are available at the committed UUID after a lost response", () => {
    const records = new Map<string, string>();
    const storage = { getItem: (key: string) => records.get(key) ?? null, setItem: (key: string, value: string) => { records.set(key, value); }, removeItem: (key: string) => { records.delete(key); } };
    const value = { scene: blankWorkshopScene, name: "Pending first save", privateId: "id", confirmed: false, sessionId: "new", updatedAt: 1 };
    persistDraftRecovery(storage, "owner", draftRecoveryKey("owner", null), value);
    expect(readDraftRecovery(storage, "owner", "id")).toMatchObject({ name: value.name, privateId: "id", confirmed: false });
    const newer = { ...value, name: "Offline ID edit", sessionId: "resumed", updatedAt: 2 };
    persistDraftRecovery(storage, "owner", draftRecoveryKey("owner", "id"), newer);
    expect(readDraftRecovery(storage, "owner", null)?.name).toBe(newer.name);
  });
  it("confirmation and discard on the UUID route clear matching new-route aliases", () => {
    const records = new Map<string, string>();
    const storage = { getItem: (key: string) => records.get(key) ?? null, setItem: (key: string, value: string) => { records.set(key, value); }, removeItem: (key: string) => { records.delete(key); } };
    const value = { scene: blankWorkshopScene, name: "Uncertain first save", privateId: "id", confirmed: false, sessionId: "new", updatedAt: 1 };
    const newKey = draftRecoveryKey("owner", null), idKey = draftRecoveryKey("owner", "id");
    persistDraftRecovery(storage, "owner", newKey, value);
    const resumed = { ...value, sessionId: "resumed", updatedAt: 2 };
    persistDraftRecovery(storage, "owner", idKey, resumed);
    expect(confirmDraftRecovery(storage, idKey, idKey, { ...resumed, confirmed: true }, true, true, "owner")).toBe(true);
    expect(readDraftRecovery(storage, "owner", "id")).toBeNull();
    expect(records.has(newKey)).toBe(false);
    persistDraftRecovery(storage, "owner", newKey, value);
    persistDraftRecovery(storage, "owner", idKey, resumed);
    removeOwnedDraftRecovery(storage, idKey, resumed.sessionId, "owner");
    expect(readDraftRecovery(storage, "owner", "id")).toBeNull();
    persistDraftRecovery(storage, "owner", newKey, value);
    clearDraftRecoveryCopies(storage, "owner", "id", draftSnapshot(value));
    expect(readDraftRecovery(storage, "owner", "id")).toBeNull();
  });
  it("alias cleanup preserves a different new draft and a newer editing session", () => {
    const records = new Map<string, string>();
    const storage = { getItem: (key: string) => records.get(key) ?? null, setItem: (key: string, value: string) => { records.set(key, value); }, removeItem: (key: string) => { records.delete(key); } };
    const value = { scene: blankWorkshopScene, name: "Saved UUID", privateId: "id", confirmed: true, sessionId: "saved", updatedAt: 1 };
    const idKey = draftRecoveryKey("owner", "id"), newKey = draftRecoveryKey("owner", null);
    persistDraftRecovery(storage, "owner", idKey, value);
    const other = { ...value, privateId: "different-id", sessionId: "different", name: "New exercise", updatedAt: 2 };
    persistDraftRecovery(storage, "owner", newKey, other);
    confirmDraftRecovery(storage, idKey, idKey, value, true, true, "owner");
    expect(readDraftRecovery(storage, "owner", null)?.name).toBe(other.name);
    persistDraftRecovery(storage, "owner", idKey, value);
    const newer = { ...value, sessionId: "newer", name: "Newer edit", updatedAt: 3 };
    storage.setItem(newKey, JSON.stringify(newer));
    confirmDraftRecovery(storage, idKey, idKey, value, true, true, "owner");
    expect(readDraftRecovery(storage, "owner", "id")?.name).toBe(newer.name);
  });
  it("a network exception does not poison later retry", async () => {
    let failed = false;
    const queue = new DraftSaveQueue("draft", async () => {
      if (!failed) { failed = true; throw new Error("Offline"); }
      return { error: null, privateId: "draft" };
    });
    expect((await queue.save(blankWorkshopScene, "Row")).error).toContain("connection");
    expect((await queue.save(blankWorkshopScene, "Row")).error).toBeNull();
  });
});
