import { expect, it } from "vitest";
import { Vector3 } from "three";
import { createAdjustableBench } from "./adjustable-bench";

it("adjusts the back pad around its hinge while the seat and feet stay stationary", () => {
  for (const degrees of [0, 15, 30, 45, 60, 85]) {
    const bench = createAdjustableBench(degrees);
    try {
      bench.root.updateMatrixWorld(true);
      const base = bench.backrest.localToWorld(new Vector3(0, 0, 0));
      const top = bench.backrest.localToWorld(new Vector3(0, 1.62, 0));
      expect(Math.atan2(top.y - base.y, base.z - top.z) * 180 / Math.PI).toBeCloseTo(degrees, 6);
      expect(base.toArray()).toEqual([0, 0.673, 0.253]);
      expect(bench.seat.position.toArray()).toEqual([0, 0.65, 0.78]);
      expect(bench.root.children.filter(child => child.position.y === 0.045).map(child => child.position.toArray())).toHaveLength(6);
    } finally { bench.dispose(); }
  }
});
