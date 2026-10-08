import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { WorkshopPreviewFallback } from "./workshop-camera-controls";
import { AnatomyControls } from "./anatomy-controls";

it.each(["loading", "unsupported", "error"] as const)("offers retry and a text alternative when preview is %s", state => {
  const html = renderToStaticMarkup(createElement(WorkshopPreviewFallback, { state, onRetry: () => undefined }));
  expect(html).toContain('type="button"');
  expect(html).toContain("Retry preview");
  expect(html).toMatch(/keep editing|editing controls remain available/);
  expect(html).not.toContain("2D");
  expect(html).toContain(state === "error" ? 'role="alert"' : 'role="status"');
});

it("keeps an unavailable creator selection visible rather than showing None", () => {
  const html = renderToStaticMarkup(createElement(AnatomyControls, { muscles: [], target: "creator-custom-oblique", isolate: false, count: 0, unavailable: true, onTargetChange: () => undefined, onIsolateChange: () => undefined }));
  expect(html).toContain('value="creator-custom-oblique" selected=""');
  expect(html).toContain("Selected highlight: creator-custom-oblique");
  expect(html).not.toContain("Loading anatomy model");
});
