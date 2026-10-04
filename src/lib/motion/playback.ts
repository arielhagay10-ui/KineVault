/** A playback clock independent of React, shared by every motion viewer. */
export class MotionPlaybackClock {
  timeMs = 0;
  playing = false;
  private previous: number | null = null;
  private listeners = new Set<() => void>();
  configure(publicDuration: number, publicSpeed = 1) {
    this.durationMs = Math.max(1, publicDuration);
    this.speed = publicSpeed;
    this.timeMs = Math.min(this.timeMs, this.durationMs);
  }
  private durationMs = 1;
  private speed = 1;
  seek(timeMs: number) {
    this.timeMs = Math.max(0, Math.min(timeMs, this.durationMs));
    this.previous = null;
    this.emit();
  }
  setPlaying(playing: boolean) { this.playing = playing; this.previous = null; this.emit(); }
  tick(now: number) {
    if (!this.playing) return;
    if (this.previous !== null) this.timeMs = (this.timeMs + Math.max(0, now - this.previous) * this.speed) % this.durationMs;
    this.previous = now;
    this.emit();
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private emit() { for (const listener of this.listeners) listener(); }
}
