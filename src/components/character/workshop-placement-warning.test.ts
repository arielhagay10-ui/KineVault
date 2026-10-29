import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { WorkshopPlacementWarning } from "./workshop-placement-warning";
import { identityTransform, type StudioObject } from "@/lib/motion/workshop";

const noop = () => undefined;
const object: StudioObject = { ...identityTransform, id: "bench", name: "Bench", slug: "bench", attachment: "none", pulleyHeight: 1 };

it("keeps the preview quiet when supports are reachable", () => {
  expect(renderToStaticMarkup(createElement(WorkshopPlacementWarning, {
    objects: [], overlapping: [], onInspect: noop,
    supports: [{ region: "left-hand", reachable: true, error: .001 }], onSupportInspect: noop,
  }))).toBe("");
});

it("combines support reach and equipment placement in the existing compact advisory", () => {
  const html = renderToStaticMarkup(createElement(WorkshopPlacementWarning, {
    objects: [object], overlapping: [object], onInspect: noop, onSupportInspect: noop,
    supports: [{ region: "left-hand", reachable: false, error: .08 }, { region: "right-knee", reachable: true, error: .001 }],
  }));
  expect(html).toContain('aria-label="2 items to check"');
  expect(html).toContain("Left hand");
  expect(html).not.toContain("Right knee");
  expect(html).toContain("Inspect support");
  expect(html).toContain("Inspect placement");
  expect(html.match(/data-workshop-placement-warning/g)).toHaveLength(1);
});

it("shows a support-only advisory without equipment overlap instructions", () => {
  const html = renderToStaticMarkup(createElement(WorkshopPlacementWarning, {
    objects: [], overlapping: [], onInspect: noop, onSupportInspect: noop,
    supports: [{ region: "back", reachable: false, error: .02 }],
  }));
  expect(html).toContain("Check placement");
  expect(html).toContain("Back");
  expect(html).not.toContain("Equipment may overlap");
});

it("reports a limited contact angle while keeping successful supports quiet", () => {
  const html = renderToStaticMarkup(createElement(WorkshopPlacementWarning, {
    objects: [], overlapping: [], onInspect: noop, onSupportInspect: noop,
    supports: [{ region: "left-forearm", reachable: true, error: .001, orientationLimited: true, orientationErrorDegrees: 30 }],
  }));
  expect(html).toContain("Check placement");
  expect(html).toContain("Left forearm");
  expect(html).toContain("Contact angle is limited");
  expect(html).not.toContain("Some supports are beyond reach");
});
