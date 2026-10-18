import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WorkshopEquipmentPicker } from "./workshop-equipment-picker";

const noop = () => undefined;

describe("equipment-only workshop instructions", () => {
  it("lets people choose equipment without suggesting an exercise", () => {
    const markup = renderToStaticMarkup(createElement(WorkshopEquipmentPicker, {
      options: [], onSelect: noop, onClose: noop, ownerKey: "equipment-instructions-test",
    }));
    expect(markup).not.toMatch(/seated pull|chest fly/);
    expect(markup).toContain("Choose equipment");
  });
});
