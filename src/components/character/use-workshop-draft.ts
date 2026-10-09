"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { saveWorkshopScene } from "@/app/my-exercises/[id]/workshop/actions";
import { DraftSaveQueue, clearDraftRecoveryCopies, confirmDraftRecovery, draftRecoveryKey, draftSnapshot, migrateDraftRecovery, persistDraftRecovery, readDraftRecovery, removeOwnedDraftRecovery, type DraftRecovery } from "@/lib/motion/workshop-draft";
import type { WorkshopScene } from "@/lib/motion/workshop";

export function useWorkshopDraft({ ownerId, privateId, initialScene, initialName, scene, name, paused }: {
  ownerId: string; privateId: string | null; initialScene: WorkshopScene; initialName: string;
  scene: WorkshopScene; name: string; paused: boolean;
}) {
  const [queue] = useState(() => new DraftSaveQueue(privateId, saveWorkshopScene));
  const [sessionId] = useState(() => crypto.randomUUID());
  const [savedId, setSavedId] = useState(privateId);
  const [message, setMessage] = useState(privateId ? "Saved privately" : "Your private draft");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recovery, setRecovery] = useState<DraftRecovery | null>(null);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [recoverable, setRecoverable] = useState(true);
  const [lastSaved, setLastSaved] = useState({ scene: initialScene, name: initialName });
  const key = draftRecoveryKey(ownerId, savedId);
  const storageKey = useRef(key);
  const snapshot = useMemo(() => draftSnapshot({ scene, name }), [scene, name]);
  const [baseline, setBaseline] = useState(() => draftSnapshot({ scene: initialScene, name: initialName }));
  const latest = useRef({ scene, name, snapshot });
  const mounted = useRef(false);
  const inFlight = useRef(0);
  const dirty = snapshot !== baseline;
  useEffect(() => { latest.current = { scene, name, snapshot }; }, [scene, name, snapshot]);
  useEffect(() => {
    mounted.current = true;
    const frame = requestAnimationFrame(() => {
    try {
      const found = readDraftRecovery(localStorage, ownerId, privateId);
      if (found) {
        // Schema default values can normalize annotations; compare scene content too.
        if (draftSnapshot(found) !== draftSnapshot({ scene: initialScene, name: initialName })) setRecovery(found);
        else clearDraftRecoveryCopies(localStorage, ownerId, found.privateId, draftSnapshot(found));
      }
    } catch { setRecoverable(false); }
    setRecoveryReady(true);
    });
    return () => { mounted.current = false; cancelAnimationFrame(frame); };
  }, [ownerId, privateId, initialScene, initialName]);
  useEffect(() => {
    if (!recoveryReady || recovery) return;
    let available = true;
    try {
      if (dirty) persistDraftRecovery(localStorage, ownerId, storageKey.current, { scene, name, privateId: queue.privateId, confirmed: queue.confirmed, sessionId, updatedAt: Date.now() });
      else if (inFlight.current === 0) removeOwnedDraftRecovery(localStorage, storageKey.current, sessionId, ownerId);
    } catch { available = false; }
    const frame = requestAnimationFrame(() => setRecoverable(available));
    return () => cancelAnimationFrame(frame);
  }, [dirty, recovery, recoveryReady, key, scene, name, queue, saving, ownerId, sessionId]);

  const saveNow = useCallback(async () => {
    if (!mounted.current) return null;
    const value = latest.current;
    if (!value.name.trim()) { setError("Name your exercise before saving."); return null; }
    if (!navigator.onLine) { setMessage("Offline · draft kept on this device"); setError("Reconnect, then Retry."); return null; }
    // Persist the request identity before the first request can commit.
    const id = queue.prepareId();
    try { persistDraftRecovery(localStorage, ownerId, storageKey.current, { ...value, privateId: id, confirmed: queue.confirmed, sessionId, updatedAt: Date.now() }); }
    catch { setRecoverable(false); }
    inFlight.current += 1; setSaving(true); setError(null); setMessage("Saving…");
    const result = await queue.save(value.scene, value.name);
    inFlight.current -= 1;
    // Another editor can own this UUID after navigation. Leave its storage alone.
    if (!mounted.current) return result;
    setSaving(inFlight.current > 0);
    if (result.error) { setError(result.error); setMessage("Could not save · draft retained"); return result; }
    const confirmedId = result.privateId ?? queue.privateId;
    if (confirmedId) {
      const nextKey = draftRecoveryKey(ownerId, confirmedId);
      try {
        const live = latest.current;
        const maintained = confirmDraftRecovery(localStorage, storageKey.current, nextKey, { scene: live.scene, name: live.name, privateId: confirmedId, confirmed: true, sessionId, updatedAt: Date.now() }, mounted.current, live.snapshot === value.snapshot && inFlight.current === 0, ownerId);
        if (maintained) storageKey.current = nextKey;
      } catch { storageKey.current = nextKey; if (mounted.current) setRecoverable(false); }
    }
    setBaseline(value.snapshot);
    setLastSaved({ scene: value.scene, name: value.name }); setSavedId(result.privateId ?? queue.privateId);
    setMessage(inFlight.current > 0 ? "Saving…"
      : `Saved at ${new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date())} · Private`);
    return { ...result, current: latest.current.snapshot === value.snapshot };
  }, [ownerId, queue, sessionId]);

  useEffect(() => {
    if (!recoveryReady || !dirty || paused || recovery || !name.trim() || error || saving) return;
    const timer = window.setTimeout(() => { void saveNow(); }, 1400);
    return () => window.clearTimeout(timer);
  }, [snapshot, dirty, paused, recovery, recoveryReady, name, error, saving, saveNow]);
  useEffect(() => {
    const offline = () => setMessage("Offline · draft kept on this device");
    const online = () => { setError(null); setMessage("Connected · ready to save"); };
    window.addEventListener("offline", offline); window.addEventListener("online", online);
    return () => { window.removeEventListener("offline", offline); window.removeEventListener("online", online); };
  }, []);
  useEffect(() => {
    if (!dirty || recoverable) return;
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    const navigate = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (anchor && !window.confirm("This draft has not saved and local recovery is unavailable. Leave and lose these edits?")) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener("beforeunload", guard);
    document.addEventListener("click", navigate, true);
    return () => { window.removeEventListener("beforeunload", guard); document.removeEventListener("click", navigate, true); };
  }, [dirty, recoverable]);
  const dismissRecovery = () => { if (recovery) { try { clearDraftRecoveryCopies(localStorage, ownerId, recovery.privateId, draftSnapshot(recovery)); } catch { /* UI remains usable. */ } } setRecovery(null); };
  const acceptRecovery = () => {
    if (recovery?.privateId) {
      queue.restoreId(recovery.privateId, recovery.confirmed !== false);
      if (recovery.confirmed !== false) {
        const nextKey = draftRecoveryKey(ownerId, recovery.privateId);
        try { migrateDraftRecovery(localStorage, storageKey.current, nextKey, recovery); storageKey.current = nextKey; }
        catch { storageKey.current = nextKey; setRecoverable(false); }
        setSavedId(recovery.privateId);
      }
    }
    setRecovery(null);
  };
  const displayMessage = dirty && (message === "Saved privately" || message.startsWith("Saved at ")) ? "Unsaved changes" : message;
  return { savedId, saving, message: displayMessage, error, dirty, recoverable, recovery, dismissRecovery, acceptRecovery, lastSaved, saveNow, currentConfirmed: !!savedId && !dirty && !saving && !error };
}
