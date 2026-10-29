/** Find the closest reachable position, preserving the current position on ties. */
export function fitMachinePose(current: number, errorAt: (position: number) => number) {
  let best = current, bestError = Infinity;
  const sample = (position: number) => {
    const error = errorAt(position) + (position - current) ** 2 * 1e-7;
    if (Number.isFinite(error) && error < bestError) { best = position; bestError = error; }
    return error;
  };
  sample(current);
  for (let step = 0; step <= 16; step++) sample(step / 16);
  let low = Math.max(0, best - 1 / 16), high = Math.min(1, best + 1 / 16);
  for (let step = 0; step < 12; step++) {
    const left = low + (high - low) / 3, right = high - (high - low) / 3;
    if (sample(left) <= sample(right)) high = right; else low = left;
  }
  return best;
}
