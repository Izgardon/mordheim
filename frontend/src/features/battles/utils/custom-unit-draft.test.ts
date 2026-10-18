import { describe, expect, it } from "vitest";

import { DEFAULT_CUSTOM_UNIT_DRAFT } from "@/features/battles/components/prebattle/prebattle-types";

import { customUnitFromDraft, draftWithStat, makeCustomUnitKey } from "./custom-unit-draft";

describe("custom-unit-draft", () => {
  it("keeps two digits per stat, and a leading minus for the armour save", () => {
    expect(draftWithStat(DEFAULT_CUSTOM_UNIT_DRAFT, "strength", "4a56").stats.strength).toBe("45");
    expect(
      draftWithStat(DEFAULT_CUSTOM_UNIT_DRAFT, "armour_save", "-1-2x3").stats.armour_save
    ).toBe("-12");
  });

  it("builds a temporary unit with trimmed names and parsed stats", () => {
    const draft = draftWithStat(
      { ...DEFAULT_CUSTOM_UNIT_DRAFT, name: " Ogre ", unitType: " Brute ", rating: "20" },
      "wounds",
      "3"
    );

    expect(customUnitFromDraft(draft, "custom:1")).toMatchObject({
      key: "custom:1",
      id: "custom:1",
      kind: "custom",
      displayName: "Ogre",
      unitType: "Brute",
      rating: 20,
      stats: { wounds: 3 },
    });
    expect(makeCustomUnitKey()).toMatch(/^custom:/);
  });
});
