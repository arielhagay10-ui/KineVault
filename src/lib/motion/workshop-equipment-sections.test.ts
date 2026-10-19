import { describe, expect, it } from "vitest";
import { workshopEquipmentSections } from "./workshop-equipment-sections";

const options = [
  { slug: "dumbbell", label: "Dumbbell" },
  { slug: "pec-deck", label: "Pec deck" },
  { slug: "cable-row-machine", label: "Cable row" },
  { slug: "leg-press", label: "Leg press" },
];

describe("equipment picker sections", () => {
  it("shows each item once with essentials, recent, favorites, catalog priority", () => {
    const sections = workshopEquipmentSections(options, {
      recent: ["dumbbell", "pec-deck", "pec-deck", "missing"],
      favorites: ["dumbbell", "pec-deck", "cable-row-machine"],
    }, false);
    expect(sections.essentials.map(item => item.slug)).toEqual(["dumbbell"]);
    expect(sections.recent.map(item => item.slug)).toEqual(["pec-deck"]);
    expect(sections.favorites.map(item => item.slug)).toEqual(["cable-row-machine"]);
    expect(sections.catalog.map(item => item.slug)).toEqual(["leg-press"]);
  });

  it("keeps every search match visible once even when recent and favorite overlap", () => {
    const sections = workshopEquipmentSections(options.slice(0, 3), {
      recent: ["pec-deck"], favorites: ["dumbbell", "pec-deck"],
    }, true);
    expect(sections.essentials).toEqual([]);
    expect(sections.recent).toEqual([]);
    expect(sections.favorites.map(item => item.slug)).toEqual(["dumbbell", "pec-deck"]);
    expect(sections.catalog.map(item => item.slug)).toEqual(["cable-row-machine"]);
  });
});
