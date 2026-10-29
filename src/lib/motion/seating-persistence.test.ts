import { describe, expect, it } from "vitest";
import { studioLayoutSchema } from "./scene-schema";
import { sampleStudioObject, setStudioObjectAnimated, updateStudioObjectTransform } from "./studio";
import { identityTransform, type StudioObject } from "./workshop";

const object = (slug: StudioObject["slug"] = "shoulder-press-machine"): StudioObject => ({
  ...identityTransform, id: "00000000-0000-4000-8000-000000000001", name: "Seat", slug,
  attachment: "none", pulleyHeight: 1.5,
});
const valid = (item: unknown) => studioLayoutSchema.safeParse({ body: identityTransform, objects: [item] }).success;

describe("seating persistence", () => {
  it("round trips seated offsets, feet, grip and independent travel", () => {
    const item = { ...object(), seatOffsetX: -.1, seatOffsetZ: .12, seatFootSupport: false, pressGrip: "neutral", machinePositionLeft: .2, machinePositionRight: .8,
      frames: [{ ...identityTransform, timeMs: 0, seatOffsetX: .1, seatOffsetZ: -.12, machinePositionLeft: .3, machinePositionRight: .7 }] };
    expect(studioLayoutSchema.parse({ body: identityTransform, objects: [item] }).objects[0]).toEqual(item);
  });

  it("accepts legacy layouts and only seats accept seat controls", () => {
    for (const slug of ["bench", "row-machine", "cable-row-machine", "pec-deck", "lat-pulldown-machine", "leg-press", "shoulder-press-machine"] as const) {
      expect(valid(object(slug))).toBe(true);
      expect(valid({ ...object(slug), seatOffsetX: .1, seatOffsetZ: -.12, seatFootSupport: true })).toBe(true);
    }
    for (const slug of ["smith-machine", "stool", "barbell", "cable-machine"] as const) {
      for (const field of [{ seatOffsetX: 0 }, { seatOffsetZ: 0 }, { seatFootSupport: true }]) expect(valid({ ...object(slug), ...field })).toBe(false);
      expect(valid({ ...object(slug), frames: [{ ...identityTransform, timeMs: 0, seatOffsetX: 0 }] })).toBe(false);
    }
  });

  it("enforces finite seat bounds in objects and frames", () => {
    for (const changes of [{ seatOffsetX: -.101 }, { seatOffsetX: .101 }, { seatOffsetZ: -.121 }, { seatOffsetZ: .121 }, { seatOffsetX: Infinity }, { seatOffsetZ: NaN }, { seatFootSupport: 1 }]) {
      expect(valid({ ...object(), ...changes })).toBe(false);
      expect(valid({ ...object(), frames: [{ ...identityTransform, timeMs: 0, ...changes }] })).toBe(false);
    }
    expect(valid({ ...object("leg-press"), seatFootSupport: false })).toBe(false);
  });

  it("restricts press and row choices while allowing press independent levers", () => {
    expect(valid({ ...object("bench"), pressGrip: "wide" })).toBe(false);
    expect(valid({ ...object(), pressGrip: "supinated" })).toBe(false);
    for (const changes of [{ rowGrip: "neutral" }, { rowSeatHeight: .6 }, { rowFootSupport: false }]) expect(valid({ ...object(), ...changes })).toBe(false);
    for (const slug of ["row-machine", "shoulder-press-machine"] as const) expect(valid({ ...object(slug), machinePositionLeft: .2, machinePositionRight: .8 })).toBe(true);
    for (const slug of ["bench", "cable-row-machine"] as const) {
      expect(valid({ ...object(slug), machinePositionLeft: .2 })).toBe(false);
      expect(valid({ ...object(slug), frames: [{ ...identityTransform, timeMs: 0, machinePositionRight: .8 }] })).toBe(false);
    }
    expect(valid({ ...object("row-machine"), rowFootSupport: false })).toBe(true);
  });

  it("accepts one or both press grips during machine use", () => {
    for (const attachment of ["left", "right", "both"]) expect(valid({ ...object(), machineUse: true, attachment })).toBe(true);
  });

  it("samples offsets linearly with zero and object fallbacks", () => {
    const item = { ...object(), seatOffsetX: -.1, frames: [
      { ...identityTransform, timeMs: 0 },
      { ...identityTransform, timeMs: 1000, seatOffsetX: .1, seatOffsetZ: .12 },
    ] };
    expect(sampleStudioObject(item, 500)).toMatchObject({ seatOffsetX: 0, seatOffsetZ: .06 });
    expect(sampleStudioObject(item, 0)).toMatchObject({ seatOffsetX: -.1 });
    expect(sampleStudioObject(item, 2000)).toMatchObject({ seatOffsetX: .1, seatOffsetZ: .12 });
  });

  it("keeps seat offsets and independent levers through frame edits and disabling animation", () => {
    const item = { ...object(), seatOffsetX: -.1, seatOffsetZ: -.12, machinePositionLeft: .125, machinePositionRight: .875, frames: [
      { ...identityTransform, timeMs: 0, seatOffsetX: -.1, seatOffsetZ: -.12, machinePositionLeft: .125, machinePositionRight: .875 },
      { ...identityTransform, timeMs: 1000, seatOffsetX: .1, seatOffsetZ: .12, machinePositionLeft: .625, machinePositionRight: .375 },
    ] };
    const moved = updateStudioObjectTransform(item, { ...identityTransform, x: 1 }, 500, true);
    expect(moved.frames?.[1]).toMatchObject({ seatOffsetX: 0, seatOffsetZ: 0, machinePositionLeft: .375, machinePositionRight: .625 });
    expect(moved.frames?.[0]).toEqual(item.frames[0]);
    const frozen = setStudioObjectAnimated(item, false, 500, []);
    expect(frozen).toMatchObject({ seatOffsetX: 0, seatOffsetZ: 0, machinePositionLeft: .375, machinePositionRight: .625 });
    expect(frozen.frames).toBeUndefined();
  });
});

