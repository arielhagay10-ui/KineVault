"use client";
import { useEffect, useMemo } from "react";
import { createAdjustableBench } from "@/lib/motion/adjustable-bench";

export function AdjustableBench({ angle = 45 }: { angle?: number }) {
  const bench = useMemo(() => createAdjustableBench(angle), [angle]);
  useEffect(() => () => bench.dispose(), [bench]);
  return <primitive object={bench.root} dispose={null} />;
}
