import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createQuickScene } from "@/lib/motion/quick-create";
import { blankWorkshopScene, studioAssetSlugs } from "@/lib/motion/workshop";
import { WorkshopQuickCreate } from "./workshop-quick-create";
import { WorkshopEquipmentPicker } from "./workshop-equipment-picker";

const noop = () => undefined;
const renderControls = (slug: string) => renderToStaticMarkup(createElement(WorkshopQuickCreate, {
  scene: slug === "bodyweight" ? blankWorkshopScene : createQuickScene(slug), step: 1, onStep: noop, onAddEquipment: noop,
  onAdd: noop, onPreviewTime: noop, onPoseMoment: noop, onMatchReturn: noop, name: "", onName: noop,
  onSave: noop, onDetails: noop, saving: false, savedId: null, currentConfirmed: false,
  confirmedName: "", language: "en", onAdvanced: noop, reachWarning: false,
}));

describe("equipment-only workshop instructions", () => {
  it.each(studioAssetSlugs)("uses the same pose controls for %s", slug => {
    const markup = renderControls(slug);
    expect(markup).not.toMatch(/Sit with feet on the footplates|close in front of the chest|Squat with planted feet/);
    expect(markup).not.toMatch(/Arms long|Handle near torso|Arms open|Hands together/);
    expect(markup).toContain("Edit start");
    expect(markup).toContain("Edit finish");
    expect(markup).toContain("Match return to start");
    expect(markup).not.toMatch(/percent|Pec deck mode|Grip options|Small range|Full range|Create repetition|Adjust fit|Use seated row/);
    expect(markup).toBe(renderControls("bodyweight"));
  });

  it("lets people choose equipment without suggesting an exercise", () => {
    const markup = renderToStaticMarkup(createElement(WorkshopEquipmentPicker, {
      options: [], onSelect: noop, onClose: noop, ownerKey: "equipment-instructions-test",
    }));
    expect(markup).not.toMatch(/seated pull|chest fly/);
    expect(markup).toContain("Choose equipment");
  });
});
