export type PreviewQuality = "auto" | "economy" | "contact";

/** Rendering preferences, not calibrated device capability classifications. */
export class PreviewResolution {
  pixelRatio = 1;
  private samples = 0;
  private elapsedMs = 0;
  // A provisional 30fps preference. Physical-device profiling must set product budgets.
  constructor(private readonly maximum: number, private readonly targetFrameMs = 1000 / 30) {}

  observe(frameMs: number, active: boolean) {
    if (!active || !Number.isFinite(frameMs) || frameMs <= 0) {
      this.samples = 0; this.elapsedMs = 0;
      return this.pixelRatio;
    }
    this.elapsedMs += frameMs;
    if (++this.samples < 30) return this.pixelRatio;
    const average = this.elapsedMs / this.samples;
    this.samples = 0; this.elapsedMs = 0;
    if (average > this.targetFrameMs * 1.25) this.pixelRatio = Math.max(.75, this.pixelRatio - .25);
    else if (average < this.targetFrameMs * .75) this.pixelRatio = Math.min(this.maximum, this.pixelRatio + .25);
    return this.pixelRatio;
  }
}
