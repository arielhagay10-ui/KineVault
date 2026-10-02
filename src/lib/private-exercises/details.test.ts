import { describe, expect, it } from "vitest";
import { blankWorkshopScene, identityTransform } from "@/lib/motion/workshop";
import { searchPrivateOptions, suggestSceneDetails } from "./details";

describe("optional exercise details", () => {
  it("finds formal muscle names through familiar body areas", () => {
    const options = [{ slug: "pectoralis-major", name: "Pectoralis major" }, { slug: "lateral-deltoid", name: "Lateral deltoid" }];
    expect(searchPrivateOptions(options, "chest")).toEqual([options[0]]);
    expect(searchPrivateOptions(options, "shoulders")).toEqual([options[1]]);
    expect(searchPrivateOptions(options, "pectoralis")).toEqual([options[0]]);
    expect(searchPrivateOptions(options, "not-a-muscle")).toEqual([]);
  });

  it("only suggests equipment present in available classifications", () => {
    const scene = { ...blankWorkshopScene, studio: { body: { ...identityTransform }, objects: [
      { ...identityTransform, id: "row", slug: "cable-row-machine" as const, name: "Row", attachment: "both" as const, pulleyHeight: 1, machineUse: true },
    ] } };
    expect(suggestSceneDetails(scene, [{ slug: "cable-row-machine", name: "Cable row" }], [{ slug: "seated", name: "Seated" }]))
      .toEqual({ equipment: ["cable-row-machine"], bodyPosition: "seated" });
    expect(suggestSceneDetails(scene, [], []).equipment).toEqual([]);
  });

  it("does not guess anatomy or body position from an unsupported scene", () => {
    expect(suggestSceneDetails(blankWorkshopScene, [], [{ slug: "standing", name: "Standing" }]))
      .toEqual({ equipment: [], bodyPosition: null });
  });

  it("leaves chest-supported bench positions unknown", () => {
    const scene = { ...blankWorkshopScene, studio: { body: { ...identityTransform }, objects: [],
      seating: { benchId: "support", facing: "back" as const } } };
    expect(suggestSceneDetails(scene, [], [{ slug: "seated", name: "Seated" }]).bodyPosition).toBeNull();
  });
});
