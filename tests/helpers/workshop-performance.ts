import { createQuickScene } from "../../src/lib/motion/quick-create";
import { blankWorkshopScene, defaultScene } from "../../src/lib/motion/workshop";

export type PerformanceWorkload = "blank" | "held" | "machine";

export function productionBuildMode(buildId: string, html: string) {
  const build = buildId.trim();
  if (html.includes("/_next/static/development/")) throw new Error("Performance origin serves development assets");
  if (!build || !html.includes(build)) throw new Error("Performance origin must serve the current production build ID");
  return { production: true, build };
}

export function performanceWorkloadScene(workload: PerformanceWorkload) {
  if (workload === "blank") return structuredClone(blankWorkshopScene);
  const scene = createQuickScene(workload === "held" ? "dumbbell-pair" : "cable-row-machine");
  if (workload === "held") scene.keyframes = structuredClone(defaultScene.keyframes);
  return scene;
}

// Blank retains its original 4/4 caps. Held adds two three-mesh weights;
// cable-row adds 39 meshes. Geometry caps include allocated selection hit targets.
export const performanceRenderBudgets = {
  blank: { calls: 4, geometries: 4 },
  held: { calls: 10, geometries: 36 },
  machine: { calls: 43, geometries: 56 },
} as const;
