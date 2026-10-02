import { describe, expect, it } from "vitest";
import { workshopShortcut } from "./workshop-shortcuts";

const key = (key: string, extra = {}) => ({ key, code: "", ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, repeat: false, isComposing: false, defaultPrevented: false, ...extra });
const canvas = { typing: false, interactive: false, blocked: false };

describe("workshop keyboard commands", () => {
  it.each([
    [key("z", { ctrlKey: true }), "undo"],
    [key("Z", { metaKey: true, shiftKey: true }), "redo"],
    [key("y", { ctrlKey: true }), "redo"],
    [key("s", { ctrlKey: true }), "save"],
    [key("d", { metaKey: true }), "duplicate"],
    [key(" ", { code: "Space" }), "play"],
    [key("["), "previous"],
    [key("]"), "next"],
    [key("e"), "edit"],
    [key("c"), "camera"],
    [key("Delete"), "remove"],
    [key("?", { shiftKey: true }), "help"],
    [key("Escape"), "escape"],
  ])("maps a supported key to its command", (event, command) => {
    expect(workshopShortcut(event, canvas)).toBe(command);
  });

  it("supports physical command keys with the Hebrew keyboard layout", () => {
    expect(workshopShortcut(key("ז", { code: "KeyZ", ctrlKey: true }), canvas)).toBe("undo");
    expect(workshopShortcut(key("ד", { code: "KeyS", metaKey: true }), canvas)).toBe("save");
  });

  it("leaves typing, native undo and editing keys to text fields", () => {
    const field = { ...canvas, typing: true, interactive: true };
    for (const event of [key("z", { ctrlKey: true }), key("d", { metaKey: true }), key(" "), key("]"), key("c"), key("Escape"), key("Delete"), key("Backspace")]) {
      expect(workshopShortcut(event, field)).toBeNull();
    }
    expect(workshopShortcut(key("s", { ctrlKey: true }), field)).toBe("save");
  });

  it("preserves button activation, sliders and handle keys", () => {
    const control = { ...canvas, interactive: true };
    for (const event of [key(" "), key("ArrowRight"), key("["), key("e"), key("Delete")]) {
      expect(workshopShortcut(event, control)).toBeNull();
    }
    expect(workshopShortcut(key("z", { ctrlKey: true }), control)).toBe("undo");
    expect(workshopShortcut(key("Escape"), control)).toBe("escape");
  });

  it("ignores dialogs, active drags, composition, repeats and consumed events", () => {
    expect(workshopShortcut(key("z", { ctrlKey: true }), { ...canvas, blocked: true })).toBeNull();
    for (const flag of ["repeat", "isComposing", "defaultPrevented", "altKey"]) {
      expect(workshopShortcut(key("z", { ctrlKey: true, [flag]: true }), canvas)).toBeNull();
    }
    expect(workshopShortcut(key("z", { ctrlKey: true, metaKey: true }), canvas)).toBeNull();
    expect(workshopShortcut(key("s", { ctrlKey: true, shiftKey: true }), canvas)).toBeNull();
    expect(workshopShortcut(key("q", { ctrlKey: true }), canvas)).toBeNull();
  });
});
