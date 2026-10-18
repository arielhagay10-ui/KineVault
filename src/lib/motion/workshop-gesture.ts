import type { WorkshopScene } from "./workshop";

export type WorkshopGestureEvent = { kind: "preview" | "finish"; scene: WorkshopScene; cancelled?: boolean };
export type WorkshopGestureResult = { before: WorkshopScene; scene: WorkshopScene; timeMs: number; changed: boolean };

/** A temporary preview owned by the editor's current gesture, never a second saved scene. */
export class WorkshopGestureScene {
  private session: { before: WorkshopScene; scene: WorkshopScene; timeMs: number } | null = null;
  private listeners = new Set<(event: WorkshopGestureEvent) => void>();

  getScene = (): WorkshopScene | null => this.session?.scene ?? null;
  getTimeMs = (): number | null => this.session?.timeMs ?? null;
  subscribe = (listener: (event: WorkshopGestureEvent) => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  begin(scene: WorkshopScene, timeMs: number) {
    if (this.session) return false;
    this.session = { before: scene, scene, timeMs };
    return true;
  }

  update(scene: WorkshopScene) {
    if (!this.session) return false;
    if (this.session.scene === scene) return true;
    this.session.scene = scene;
    this.emit({ kind: "preview", scene });
    return true;
  }

  finish(cancelled = false): WorkshopGestureResult | null {
    const session = this.session;
    if (!session) return null;
    const scene = cancelled ? session.before : session.scene;
    // Equality is checked once at the transaction boundary, never per pointer move.
    const changed = !cancelled && scene !== session.before && JSON.stringify(scene) !== JSON.stringify(session.before);
    this.session = null;
    this.emit({ kind: "finish", scene, cancelled });
    return { before: session.before, scene, timeMs: session.timeMs, changed };
  }

  private emit(event: WorkshopGestureEvent) { for (const listener of this.listeners) listener(event); }
}

/** Trailing throttle: moving continuously still produces bounded recovery checkpoints. */
export class RecoveryCheckpoint<T> {
  private pending: { value: T } | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly write: (value: T) => void, private readonly intervalMs = 500) {}

  schedule(value: T) {
    this.pending = { value };
    if (this.timer === null) this.timer = setTimeout(() => this.flush(), this.intervalMs);
  }

  flush(...value: [] | [T]) {
    const pending = value.length ? { value: value[0] } : this.pending;
    this.cancel();
    if (pending) this.write(pending.value);
  }

  cancel() {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.pending = null;
  }
}
