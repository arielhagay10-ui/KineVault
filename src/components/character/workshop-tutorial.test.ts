import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WorkshopGuidance, WorkshopGuidanceProvider } from "./workshop-guidance";

describe("workshop guidance", () => {
  it("omits tutorial explanations outside the tutorial", () => {
    const markup = renderToStaticMarkup(createElement(WorkshopGuidance, null, "Drag equipment directly."));
    expect(markup).toBe("");
  });
  it("shows explanations when the user opens the tutorial", () => {
    const markup = renderToStaticMarkup(createElement(WorkshopGuidanceProvider, { enabled: true },
      createElement(WorkshopGuidance, null, "Drag equipment directly.")));
    expect(markup).toContain("Drag equipment directly.");
  });
});
