import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { WorkshopSupportControls, type WorkshopSupportControlsProps } from "./workshop-support-controls";
import type { SupportContact } from "@/lib/motion/workshop";

const noop = () => undefined;
const props: WorkshopSupportControlsProps = {
  region: "left-hand", picking: false, onRegionChange: noop, onPick: noop,
  onAdjust: noop, onChange: noop, onRelease: noop, onReposition: noop, onCancel: noop,
};
const contact: SupportContact = { region: "left-hand", objectId: null, surface: "floor", point: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 1, z: 0 }, turn: 0 };
const render = (overrides: Partial<WorkshopSupportControlsProps> = {}) => renderToStaticMarkup(createElement(WorkshopSupportControls, { ...props, ...overrides }));

it("starts with the support action and keeps detailed controls hidden until a contact exists", () => {
  const html = render();
  expect(html).toContain("Support on…");
  expect(html).not.toContain("Fine adjustment");
  expect(html).not.toContain("Release");
  expect(html).toContain('value="left-forearm"');
  expect(html).toContain('value="pelvis"');
});

it("exposes anchored contact actions and only editable floor coordinates", () => {
  const html = render({ contact });
  expect(html).toContain("Adjust position");
  expect(html).toContain("Reposition body");
  expect(html).toContain("Release");
  expect(html).toContain("Support X meters");
  expect(html).toContain("Support Z meters");
  expect(html).not.toContain("Support Y meters");
  expect(html).toContain("stays anchored");
});

it("reposition preview offers confirmation and cancellation without editing the contact", () => {
  const html = render({ contact, repositioning: true, onConfirmReposition: noop });
  expect(html).toContain("Use position");
  expect(html).toContain("Cancel");
  expect(html).not.toContain("Release");
  expect(html).not.toContain("Fine adjustment");
});

it("shows surface picking instructions and placement failures accessibly", () => {
  const html = render({ picking: true, error: "This contact is beyond reach." });
  expect(html).toContain("Hover to preview");
  expect(html).toContain('role="alert"');
  expect(html).toContain("This contact is beyond reach.");
});
