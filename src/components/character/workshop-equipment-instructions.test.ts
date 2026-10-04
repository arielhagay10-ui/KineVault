import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createQuickScene } from "@/lib/motion/quick-create";
import { WorkshopQuickCreate } from "./workshop-quick-create";
import { WorkshopEquipmentPicker } from "./workshop-equipment-picker";

const noop = () => undefined;
const renderControls = (slug: string, showExampleInstructions = false) => renderToStaticMarkup(createElement(WorkshopQuickCreate, {
  scene: createQuickScene(slug), step: 1, onStep: noop, onChange: noop, onExample: noop,
  onAdd: noop, onPreviewTime: noop, onMouseEdit: noop, onFreeCable: noop, onPoseMoment: noop, onMatchReturn: noop, name: "", onName: noop,
  onSave: noop, onDetails: noop, saving: false, savedId: null, currentConfirmed: false,
  confirmedName: "", language: "en", onAdvanced: noop, reachWarning: false,
  showExampleInstructions,
}));

describe("equipment-only workshop instructions", () => {
  it.each(["cable-row-machine", "pec-deck", "smith-machine"])("does not prescribe an exercise for %s", slug => {
    const markup = renderControls(slug);
    expect(markup).not.toMatch(/Sit with feet on the footplates|close in front of the chest|Squat with planted feet/);
    expect(markup).not.toMatch(/Arms long|Handle near torso|Arms open|Hands together/);
    expect(markup).toContain("View start");
    expect(markup).toContain("View finish");
  });

  it("keeps exercise instructions when an example is explicitly chosen", () => {
    const markup = renderControls("cable-row-machine", true);
    expect(markup).toContain("Sit with feet on the footplates");
    expect(markup).toContain("Arms long");
    expect(markup).toContain("Handle near torso");
  });

  it("lets people choose equipment without suggesting an exercise", () => {
    const markup = renderToStaticMarkup(createElement(WorkshopEquipmentPicker, {
      options: [], onSelect: noop, onClose: noop, ownerKey: "equipment-instructions-test",
    }));
    expect(markup).not.toMatch(/seated pull|chest fly/);
    expect(markup).toContain("Choose equipment");
  });
});
