import { describe, expect, it } from "vitest";
import { createWorkshopLanguage, parseLocalizedWorkshopNumber, workshopDirection } from "./workshop-language";

describe("workshop language", () => {
  it("translates essential steps, warnings and recovery instructions", () => {
    const { t } = createWorkshopLanguage("he");
    for (const text of ["Choose equipment", "Start and finish", "Preview", "Name and save", "Retry saving", "Restore recovered draft", "A hand cannot reach its handle. Use a smaller range or reset fit; inspect the wrist from the opposite side.", "Enable browser graphics acceleration or try another browser. The text summary and editing controls remain available."]) {
      expect(t(text)).toMatch(/[א-ת]/);
      expect(t(text)).not.toBe(text);
    }
  });

  it("substitutes named parameters and localizes compound labels", () => {
    const { t } = createWorkshopLanguage("he");
    expect(t("Favorite {equipment}", { equipment: "Cable row" })).toBe("הוספת חתירה בכבל למועדפים");
    expect(t("Start Row pull percent")).toBe("התחלה משיכת חתירה באחוזים");
    expect(t("Enter a number from {min} to {max}.", { min: -1.5, max: 2 })).toMatch(/2/);
    expect(t("Left wrist bends 54° to keep hold.")).toMatch(/[א-ת].*54/);
  });

  it("preserves missing translations and scientific names", () => {
    expect(createWorkshopLanguage("he").t("Latissimus dorsi")).toBe("Latissimus dorsi");
    expect(createWorkshopLanguage("he").t("Unregistered label")).toBe("Unregistered label");
    expect(createWorkshopLanguage("en").t("Favorite {equipment}", { equipment: "Cable row" })).toBe("Favorite Cable row");
  });

  it("formats Hebrew numbers without changing their numeric value", () => {
    const { formatNumber } = createWorkshopLanguage("he");
    expect(formatNumber(1234.5)).toBe("1,234.5");
    const negative = formatNumber(-1.25, { useGrouping: false });
    expect(negative).toContain("-1.25");
    expect(parseLocalizedWorkshopNumber(negative, -2, 2)).toBe(-1.25);
    expect(parseLocalizedWorkshopNumber("", -2, 2)).toBeNull();
    expect(parseLocalizedWorkshopNumber("2.1", -2, 2)).toBeNull();
  });

  it("selects RTL for Hebrew and LTR for English", () => {
    expect(workshopDirection("he")).toBe("rtl");
    expect(workshopDirection("en")).toBe("ltr");
  });
});
