import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WorkshopJointPicker } from "./workshop-joint-picker";

describe("compact joint selection", () => {
  it("defaults to both sides for paired joints", () => {
    const markup = renderToStaticMarkup(createElement(WorkshopJointPicker, {
      compact: true, selected: "left-shoulder", onSelect: () => undefined,
    }));
    expect(markup).toMatch(/aria-pressed="true"[^>]*>Both<\/button>/);
  });
  it("keeps the family selected when an external selection changes sides", () => {
    const markup = renderToStaticMarkup(createElement(WorkshopJointPicker, {
      compact: true, selected: "right-wrist", bothSides: false, onSelect: () => undefined,
    }));
    expect(markup.match(/<option /g)).toHaveLength(8);
    expect(markup).toContain('<option value="wrist" selected="">Wrist</option>');
    expect(markup).toMatch(/aria-pressed="true"[^>]*>Right<\/button>/);
  });

  it("exposes Both as the active side for a paired joint", () => {
    const markup = renderToStaticMarkup(createElement(WorkshopJointPicker, {
      compact: true, selected: "left-shoulder", bothSides: true, onSelect: () => undefined,
    }));
    expect(markup).toContain('role="group" aria-label="Body side"');
    expect(markup).toMatch(/aria-pressed="true"[^>]*>Both<\/button>/);
    expect(markup).toMatch(/aria-pressed="false"[^>]*>Left<\/button>/);
  });

  it("omits side controls for the torso", () => {
    const markup = renderToStaticMarkup(createElement(WorkshopJointPicker, {
      compact: true, selected: "torso", onSelect: () => undefined,
    }));
    expect(markup).toContain('<option value="torso" selected="">Torso</option>');
    expect(markup).not.toContain('aria-label="Body side"');
  });
});
