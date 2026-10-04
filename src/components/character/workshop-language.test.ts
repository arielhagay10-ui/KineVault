import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WorkshopLanguageProvider, useWorkshopLanguage } from "./workshop-language";
import { WorkshopGuidance, WorkshopGuidanceProvider } from "./workshop-guidance";
import { WorkshopComparison } from "./workshop-comparison";
import { WorkshopGripControls } from "./workshop-grip-controls";
import { createStudioObject } from "@/lib/motion/studio";
import { blankWorkshopScene } from "@/lib/motion/workshop";
import { MotionCanvas } from "./motion-canvas";

describe("workshop translation rendering", () => {
  it("translates intrinsic labels and accessible names without changing input values", () => {
    function Labels() {
      const { t } = useWorkshopLanguage();
      return createElement("div", null,
        createElement("button", { "aria-label": t("Choose equipment"), title: t("Preview") }, t("Choose equipment")),
        createElement("input", { placeholder: t("Name your private exercise"), defaultValue: "Preview" }),
        createElement("span", { "data-workshop-translate": "false" }, "Preview"));
    }
    const markup = renderToStaticMarkup(createElement(WorkshopLanguageProvider, { language: "he" }, createElement(Labels)));
    expect(markup).toContain('aria-label="בחירת ציוד"');
    expect(markup).toContain('title="תצוגה מקדימה"');
    expect(markup).toContain('placeholder="שם לתרגיל הפרטי שלך"');
    expect(markup).toContain('value="Preview"');
    expect(markup).toContain('data-workshop-translate="false">Preview');
  });

  it("keeps essential guidance after closing the tutorial and labels stacked comparison views", () => {
    const markup = renderToStaticMarkup(createElement(WorkshopGuidanceProvider, { enabled: false },
      createElement(WorkshopGuidance, null, "Optional tutorial copy"),
      createElement(WorkshopGuidance, { essential: true }, "The machine controls this joint")));
    expect(markup).not.toContain("Optional tutorial copy");
    expect(markup).toContain("The machine controls this joint");
    const comparison = renderToStaticMarkup(createElement(WorkshopLanguageProvider, { language: "he" }, createElement(WorkshopComparison, { scene: blankWorkshopScene })));
    expect(comparison).toContain("grid-cols-1"); expect(comparison).toContain("sm:grid-cols-2");
    expect(comparison).toContain('aria-label="השוואת תנוחת ההתחלה"');
    expect(comparison).toContain('aria-label="השוואת תנוחת הסיום"');
  });

  it("provides the selected language to nested workshop controls", () => {
    function Control() {
      const { language, t, formatNumber } = useWorkshopLanguage();
      return createElement("button", { lang: language }, t("Zoom in"), " ", formatNumber(.5));
    }
    const markup = renderToStaticMarkup(createElement(WorkshopLanguageProvider, { language: "he" }, createElement(Control)));
    expect(markup).toContain('lang="he"');
    expect(markup).toContain("קירוב 0.5");
  });
  it("renders grip choices, endpoint inspection and geometry repair in Hebrew", () => {
    const object = createStudioObject("cable-row-machine", "row", 0);
    const markup = renderToStaticMarkup(createElement(WorkshopLanguageProvider, { language: "he" }, createElement(WorkshopGripControls, {
      object, onChange: () => undefined, onPreviewPose: () => undefined, onRepairRange: () => undefined,
      reach: { objectId: object.id, timeMs: 0, hands: [], warnings: [{ side: "left", kind: "reach", message: "Left hand cannot reach the handle.", repair: "Shorten the start or finish range until the hand touches the handle." }] },
    })));
    expect(markup).toContain("לאיזה כיוון פונות כפות הידיים");
    expect(markup).toContain("יד שמאל אינה מגיעה לידית");
    expect(markup).toContain("קצרו את טווח ההתחלה או הסיום");
    expect(markup).not.toContain("Check both hands at finish");
    expect(markup).not.toContain("Palms outward");
  });
  it("localizes preview summary, timing and contacts while preserving user equipment names", () => {
    const object = { ...createStudioObject("dumbbell", "weight", 0), name: "Preview", attachment: "both" as const };
    const scene = { ...blankWorkshopScene, studio: { ...blankWorkshopScene.studio!, objects: [object] } };
    const markup = renderToStaticMarkup(createElement(WorkshopLanguageProvider, { language: "he" }, createElement(MotionCanvas, { scene, timeMs: 1600, simplifiedControls: true })));
    expect(markup).toContain("תקציר הסצנה בטקסט");
    expect(markup).toContain("זמן התצוגה כעת");
    expect(markup).toContain("חיבור לשתי הידיים");
    expect(markup).toContain('data-workshop-translate="false">Preview');
    expect(markup).not.toContain("Current preview time:");
    expect(markup).not.toContain("Text scene summary");
  });
});
