import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { WorkshopNumberField } from "./workshop-number-field";

it("limits angle display precision without changing fine placement fields", () => {
  const props = { label: "Bend", value: -23.348515, onChange: () => undefined };
  const angle = renderToStaticMarkup(createElement(WorkshopNumberField,
    { ...props, maximumFractionDigits: 2 }));
  expect(angle).toContain('value="-23.35"');
  expect(renderToStaticMarkup(createElement(WorkshopNumberField, props))).toContain('value="-23.348515"');
});
