import { describe, expect, it } from "vitest";

import { bestiaryEntry } from "@/test/catalogue-fixtures";

import { beastDraft, beastStats, beastWounds } from "./bestiary-creature";

describe("a bestiary creature in a battle", () => {
  it("brings its profile, numbers only", () => {
    expect(beastStats(bestiaryEntry({ armour_save: 6, ballistic_skill: null }))).toEqual({
      movement: 6,
      weapon_skill: 4,
      strength: 4,
      toughness: 3,
      wounds: 1,
      initiative: 4,
      attacks: 1,
      leadership: 5,
      armour_save: 6,
    });
    expect(beastStats(bestiaryEntry({ has_profile: false }))).toBeUndefined();
  });

  it("fills a temporary unit with its name, rating and profile", () => {
    expect(beastDraft(bestiaryEntry({ rating: 12 }))).toEqual({
      name: "Warhound",
      unitType: "Warhound",
      rating: "12",
      stats: {
        movement: "6",
        weapon_skill: "4",
        ballistic_skill: "0",
        strength: "4",
        toughness: "3",
        wounds: "1",
        initiative: "4",
        attacks: "1",
        leadership: "5",
        armour_save: "",
      },
    });
  });

  it("keeps its wounds from 1 to 10", () => {
    expect(beastWounds(bestiaryEntry({ wounds: 3 }))).toBe(3);
    expect(beastWounds(bestiaryEntry({ wounds: null }))).toBe(1);
    expect(beastWounds(undefined)).toBe(1);
  });
});
