import { describe, expect, it } from "vitest";
import { createQuickScene } from "./quick-create";
import { describeWorkshopChange, workshopMomentName } from "./workshop-history";
import { captureWorkshopSetup, applyWorkshopSetup, readWorkshopSetups, workshopSetupKey } from "./workshop-setups";

describe("workshop improvements", () => {
  it("names placement, contact, and endpoint changes", () => {
    const scene = createQuickScene("cable-row-machine");
    const moved = structuredClone(scene);
    moved.studio!.objects[0].x += 1;
    expect(describeWorkshopChange(scene, moved)).toBe("Move Cable row");
    const contact = structuredClone(scene);
    contact.studio!.objects[0].machineGrip = "pronated";
    expect(describeWorkshopChange(scene, contact)).toBe("Change Cable row contact");
    const posed = structuredClone(scene);
    posed.keyframes[1].poses.torso = { x: 10, y: 0, z: 0 };
    expect(describeWorkshopChange(scene, posed)).toBe("Change finish pose");
  });
  it("labels the repetition endpoints and keeps extra poses numbered", () => {
    expect(workshopMomentName(0, 3200)).toBe("Start");
    expect(workshopMomentName(1600, 3200)).toBe("Finish");
    expect(workshopMomentName(3200, 3200)).toBe("Return");
    expect(workshopMomentName(800, 3200, 1)).toBe("Pose 2");
  });
  it("reuses static equipment and camera without replacing the exercise motion", () => {
    const source = createQuickScene("cable-row-machine");
    source.studio!.presentation!.view = "side";
    const setup = captureWorkshopSetup(source, "My row", "saved-setup");
    expect(setup.studio.objects[0].frames).toBeUndefined();
    const target = createQuickScene("pec-deck");
    const result = applyWorkshopSetup(target, setup);
    expect(result.keyframes).toEqual(target.keyframes);
    expect(result.durationMs).toBe(target.durationMs);
    expect(result.studio?.objects[0].slug).toBe("cable-row-machine");
    expect(result.studio?.presentation?.view).toBe("side");
    expect(target.studio?.objects[0].slug).toBe("pec-deck");
  });
  it("rejects malformed setups and isolates owners", () => {
    expect(workshopSetupKey("alice")).not.toBe(workshopSetupKey("bob"));
    expect(readWorkshopSetups("broken JSON")).toEqual([]);
    expect(readWorkshopSetups(JSON.stringify([{ name: "bad", studio: {} }]))).toEqual([]);
    const setup = captureWorkshopSetup(createQuickScene("pec-deck"), "Chest", "setup");
    expect(readWorkshopSetups(JSON.stringify([setup]))).toEqual([setup]);
  });
});
