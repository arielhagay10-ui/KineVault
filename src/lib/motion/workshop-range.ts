/** Local input feedback while the editor keeps scene commits at gesture boundaries. */
export class WorkshopRangePreview {
  private preview: number | null = null;
  private listeners = new Set<() => void>();
  constructor(private committed: number) {}
  getSnapshot = () => this.preview ?? this.committed;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  configure(value: number) {
    const previous = this.getSnapshot();
    this.committed = value;
    this.emit(previous);
  }
  change(value: number) {
    const previous = this.getSnapshot();
    this.preview = value;
    this.emit(previous);
  }
  reset() {
    const previous = this.getSnapshot();
    this.preview = null;
    this.emit(previous);
  }
  private emit(previous: number) {
    if (previous !== this.getSnapshot()) for (const listener of this.listeners) listener();
  }
}
