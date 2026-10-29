"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { saveWorkshopScene } from "@/app/my-exercises/[id]/workshop/actions";
import { DraftSaveQueue, clearDraftRecoveryCopies, confirmDraftRecovery, draftRecoveryKey, draftSnapshot, migrateDraftRecovery, persistDraftRecovery, readDraftRecovery, removeOwnedDraftRecovery, type DraftRecovery } from "@/lib/motion/workshop-draft";
import type { WorkshopScene } from "@/lib/motion/workshop";
import { RecoveryCheckpoint, type WorkshopGestureScene } from "@/lib/motion/workshop-gesture";

export function useWorkshopDraft({ ownerId, privateId, initialScene, initialName, scene, name, firstPoseInitialized, paused, gesture }: {
  ownerId: string; privateId: string | null; initialScene: WorkshopScene; initialName: string;
  scene: WorkshopScene; name: string; firstPoseInitialized: boolean; paused: boolean; gesture?: WorkshopGestureScene;
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
  const latest = useRef({ scene, name, snapshot, firstPoseInitialized });
  const mounted = useRef(false);
  const inFlight = useRef(0);
  const dirty = snapshot !== baseline;
  const captureLatest = useCallback(() => {
    const live = latest.current;
    const preview = gesture?.getScene();
    return preview && preview !== live.scene ? { ...live, scene: preview, snapshot: draftSnapshot({ scene: preview, name: live.name }) } : live;
  }, [gesture]);
  useEffect(() => { latest.current = { scene, name, snapshot, firstPoseInitialized }; }, [scene, name, snapshot, firstPoseInitialized]);
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
      if (dirty) persistDraftRecovery(localStorage, ownerId, storageKey.current, { scene, name, firstPoseInitialized, privateId: queue.privateId, confirmed: queue.confirmed, sessionId, updatedAt: Date.now() });
      else if (inFlight.current === 0) removeOwnedDraftRecovery(localStorage, storageKey.current, sessionId, ownerId);
    } catch { available = false; }
    const frame = requestAnimationFrame(() => setRecoverable(available));
    return () => cancelAnimationFrame(frame);
  }, [dirty, recovery, recoveryReady, key, scene, name, firstPoseInitialized, queue, saving, ownerId, sessionId]);

  useEffect(() => {
    if (!recoveryReady || recovery) return;
    const checkpoint = new RecoveryCheckpoint<WorkshopScene>(preview => {
      const value = { scene: preview, name: latest.current.name, firstPoseInitialized: latest.current.firstPoseInitialized };
      try {
        if (draftSnapshot(value) !== baseline) persistDraftRecovery(localStorage, ownerId, storageKey.current, { ...value, privateId: queue.privateId, confirmed: queue.confirmed, sessionId, updatedAt: Date.now() });
        else if (inFlight.current === 0) removeOwnedDraftRecovery(localStorage, storageKey.current, sessionId, ownerId);
      } catch { if (mounted.current) setRecoverable(false); }
    });
    const unsubscribe = gesture?.subscribe(event => {
      if (event.kind === "preview") checkpoint.schedule(event.scene);
      else {
        // Completion precedes the owner's React commit; lifecycle/save callbacks
        // in this event must already see the completed or cancelled scene.
        latest.current = { ...latest.current, scene: event.scene, snapshot: draftSnapshot({ scene: event.scene, name: latest.current.name }) };
        checkpoint.flush(event.scene);
      }
    });
    const flush = () => checkpoint.flush(gesture?.getScene() ?? latest.current.scene);
    const hidden = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    window.addEventListener("blur", flush);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      // Flush before dropping the owner/session closure, including route unmounts.
      flush(); unsubscribe?.(); checkpoint.cancel();
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
      window.removeEventListener("blur", flush);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [gesture, recoveryReady, recovery, baseline, ownerId, queue, sessionId]);

  const saveNow = useCallback(async (requestedName?: string) => {
    if (!mounted.current) return null;
    const live = captureLatest();
    const value = requestedName === undefined ? live : {
      ...live, name: requestedName, snapshot: draftSnapshot({ scene: live.scene, name: requestedName }),
    };
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
      // Keep in-flight edits mounted while making refresh load the saved draft.
      if (!privateId && window.location.pathname === "/my-exercises/new") window.history.replaceState(null, "", `/my-exercises/${confirmedId}/workshop`);
      const nextKey = draftRecoveryKey(ownerId, confirmedId);
      try {
        const live = captureLatest();
        const maintained = confirmDraftRecovery(localStorage, storageKey.current, nextKey, { scene: live.scene, name: live.name, firstPoseInitialized: live.firstPoseInitialized, privateId: confirmedId, confirmed: true, sessionId, updatedAt: Date.now() }, mounted.current, live.snapshot === value.snapshot && inFlight.current === 0, ownerId);
        if (maintained) storageKey.current = nextKey;
      } catch { storageKey.current = nextKey; if (mounted.current) setRecoverable(false); }
    }
    setBaseline(value.snapshot);
    setLastSaved({ scene: value.scene, name: value.name }); setSavedId(result.privateId ?? queue.privateId);
    setMessage(inFlight.current > 0 ? "Saving…"
      : `Saved at ${new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date())} · Private`);
    return { ...result, current: captureLatest().snapshot === value.snapshot };
  }, [captureLatest, ownerId, privateId, queue, sessionId]);

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
    if (recoverable) return;
    const unsaved = () => dirty || !!gesture?.getScene();
    const guard = (event: BeforeUnloadEvent) => { if (unsaved()) event.preventDefault(); };
    const navigate = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (anchor && unsaved() && !window.confirm("This draft has not saved and local recovery is unavailable. Leave and lose these edits?")) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener("beforeunload", guard);
    document.addEventListener("click", navigate, true);
    return () => { window.removeEventListener("beforeunload", guard); document.removeEventListener("click", navigate, true); };
  }, [dirty, recoverable, gesture]);
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
