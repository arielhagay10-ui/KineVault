import { describe, expect, it } from "vitest";
import { machineDemoScene } from "./studio-machines";
import { workshopSceneSchema } from "./scene-schema";
import { deleteWorkshopFrame, retimeWorkshopFrame } from "./timeline";

const demo = () => machineDemoScene("smith-machine", "00000000-0000-4000-8000-000000000001");

describe("workshop frame editing", () => {
  it("retimes the body and matching machine frame together without changing their values", () => {
    const original = demo();
    const edited = retimeWorkshopFrame(original, 4, 1300);
    expect(edited.keyframes[4]).toEqual({ ...original.keyframes[4], timeMs: 1300 });
    expect(edited.studio!.objects[0].frames![4]).toEqual({ ...original.studio!.objects[0].frames![4], timeMs: 1300 });
    expect(original.keyframes[4].timeMs).toBe(1200);
    expect(workshopSceneSchema.safeParse(edited).success).toBe(true);
  });
  it("rejects moving past another body or independent equipment frame or the endpoints", () => {
    const scene = demo();
    scene.studio!.objects[0].frames!.splice(5, 0, { ...scene.studio!.objects[0].frames![4], timeMs: 1250 });
    for (const time of [900, 1250, 1500, NaN, 1200.5]) expect(() => retimeWorkshopFrame(scene, 4, time)).toThrow();
    expect(() => retimeWorkshopFrame(scene, 0, 100)).toThrow();
    expect(() => retimeWorkshopFrame(scene, 16, 4700)).toThrow();
  });
  it("deletes matching body and machine frames and keeps unrelated moments", () => {
    const scene = demo();
    const edited = deleteWorkshopFrame(scene, 4);
    expect(edited.keyframes.map(frame => frame.timeMs)).not.toContain(1200);
    expect(edited.studio!.objects[0].frames!.map(frame => frame.timeMs)).not.toContain(1200);
    expect(edited.studio!.objects[0].frames).toHaveLength(16);
    expect(edited.keyframes[3]).toEqual(scene.keyframes[3]);
    expect(scene.keyframes).toHaveLength(17);
    expect(workshopSceneSchema.safeParse(edited).success).toBe(true);
  });
  it("allows endpoint deletion by moving the next surviving pose and matching carriage to the boundary", () => {
    for (const index of [0, 16]) {
      const scene = demo(), edited = deleteWorkshopFrame(scene, index);
      const position = index === 0 ? 0 : 15, source = index === 0 ? 1 : 15;
      expect(edited.keyframes[position].timeMs).toBe(index === 0 ? 0 : 4800);
      expect(edited.studio!.objects[0].frames![position].machinePosition).toBe(scene.studio!.objects[0].frames![source].machinePosition);
      expect(edited.studio!.objects[0].frames![position].timeMs).toBe(edited.keyframes[position].timeMs);
      expect(workshopSceneSchema.safeParse(edited).success).toBe(true);
    }
  });
  it("protects the last two frames and removes an emptied equipment track", () => {
    const scene = demo();
    scene.studio!.objects[0].frames = [scene.studio!.objects[0].frames![0]];
    scene.studio!.objects[0].frames[0].machinePosition = 0.7;
    const deleted = deleteWorkshopFrame(scene, 0).studio!.objects[0];
    expect(deleted.frames).toBeUndefined();
    expect(deleted.machinePosition).toBe(0.7);
    scene.keyframes = [scene.keyframes[0], scene.keyframes.at(-1)!];
    expect(() => deleteWorkshopFrame(scene, 0)).toThrow();
    expect(() => deleteWorkshopFrame(scene, 1)).toThrow();
    expect(() => deleteWorkshopFrame(scene, -1)).toThrow();
  });
  it("keeps independent equipment moments ordered when an endpoint is promoted", () => {
    const scene = demo();
    scene.keyframes = [scene.keyframes[0], scene.keyframes[2], scene.keyframes[14], scene.keyframes[16]];
    for (const index of [0, 3]) expect(workshopSceneSchema.safeParse(deleteWorkshopFrame(scene, index)).success).toBe(true);
  });
  it("moves matching phase markers with a frame and protects nearby annotation boundaries", () => {
    const scene = demo();
    scene.annotations = [{ startMs: 900, endMs: 1200, label: "Lower", note: null, jointAction: null }];
    expect(retimeWorkshopFrame(scene, 4, 1300).annotations![0].endMs).toBe(1300);
    scene.annotations.push({ startMs: 1200, endMs: 1250, label: "Hold", note: null, jointAction: null });
    expect(() => retimeWorkshopFrame(scene, 4, 1300)).toThrow();
  });
  it.each([0, 2])("keeps sparse equipment motion at the promoted pose when endpoint %s is deleted", index => {
    const scene = demo();
    scene.keyframes = [scene.keyframes[0], scene.keyframes[8], scene.keyframes[16]];
    scene.studio!.objects[0].frames = [scene.studio!.objects[0].frames![0], scene.studio!.objects[0].frames![16]];
    scene.studio!.objects[0].frames![1].machinePosition = 0;
    const edited = deleteWorkshopFrame(scene, index);
    expect(workshopSceneSchema.safeParse(edited).success).toBe(true);
    expect(edited.studio!.objects[0].frames).toHaveLength(2);
    expect(edited.studio!.objects[0].frames![0].timeMs).toBe(0);
    expect(edited.studio!.objects[0].frames![index === 0 ? 0 : 1].machinePosition).toBe(0.5);
    expect(edited.studio!.objects[0].frames![1].timeMs).toBe(4800);
  });
});
