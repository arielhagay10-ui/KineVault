import { describe, expect, it } from "vitest";
import { productionBuildMode, performanceWorkloadScene } from "./workshop-performance";
import { workshopSceneSchema } from "../../src/lib/motion/scene-schema";

describe("performance contracts", () => {
  it("requires the served HTML to identify the locally built production artifact", () => {
    expect(productionBuildMode("build-123", '<script>"build-123"</script>')).toEqual({ production: true, build: "build-123" });
    expect(() => productionBuildMode("build-123", '<script>"development"</script>')).toThrow(/production build/);
    expect(() => productionBuildMode("", "anything")).toThrow(/production build/);
    expect(() => productionBuildMode("build-123", 'build-123 /_next/static/development/')).toThrow(/development/);
  });

  it.each(["blank", "held", "machine"] as const)("creates a validated %s workload with distinct equipment", workload => {
    const scene = performanceWorkloadScene(workload);
    expect(workshopSceneSchema.safeParse(scene).success).toBe(true);
    expect(scene.equipment).toBeNull();
    if (workload === "blank") expect(scene.studio!.objects).toHaveLength(0);
    if (workload === "held") {
      expect(scene.studio!.objects.map(item => [item.slug, item.attachment])).toEqual([["dumbbell", "left"], ["dumbbell", "right"]]);
      expect(scene.keyframes[1].poses).not.toEqual(scene.keyframes[0].poses);
    }
    if (workload === "machine") {
      expect(scene.studio!.objects).toHaveLength(1);
      expect(scene.studio!.objects[0]).toMatchObject({ slug: "cable-row-machine", machineUse: true });
      expect(scene.studio!.objects[0].frames?.some(frame => frame.machinePosition === 1)).toBe(true);
    }
  });
});
