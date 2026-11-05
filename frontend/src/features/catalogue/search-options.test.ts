import { describe, expect, it } from "vitest";

import { spell } from "@/test/catalogue-fixtures";
import { makeSpecial } from "@/test/warband-fixtures";

import { specialOption, spellOptions } from "./search-options";

describe("specialOption", () => {
  it("says a priced special's price beside its type, and only its type without one", () => {
    const claw = makeSpecial({ id: 7, name: "Great Claw", type: "Mutation", cost: 50 });
    expect(specialOption(claw, new Map()).subtitle).toBe("Mutation · 50 gc");
    expect(specialOption({ ...claw, cost: 0 }, new Map()).subtitle).toBe("Mutation · 0 gc");
    expect(specialOption({ ...claw, cost: null }, new Map()).subtitle).toBe("Mutation");
    expect(specialOption({ ...claw, type: null, cost: 35 }, new Map()).subtitle).toBe("35 gc");
  });
});

const spells = [
  spell({ id: 1, name: "Age of Stone", type: "Charms and Hexes" }),
  spell({ id: 2, name: "Angvar's Fury", type: "Norse Runes" }),
  spell({ id: 3, name: "Dark Blood", type: "Chaos Rituals", in_play: false }),
  spell({ id: 4, name: "Vision of Torment", type: "Chaos Rituals" }),
  spell({ id: 5, name: "Fireball", type: "Lesser Magic" }),
];

describe("spellOptions", () => {
  it("puts his lores first, then the rest, the greyed rows last in each", () => {
    const rows = spellOptions(spells, new Map(), ["Chaos Rituals", "lesser magic"]);
    expect(rows.map((row) => [row.title, row.group])).toEqual([
      ["Vision of Torment", "His lores"],
      ["Fireball", "His lores"],
      ["Dark Blood", "His lores"],
      ["Age of Stone", "Other lores"],
      ["Angvar's Fury", "Other lores"],
    ]);
  });

  it("lists every spell as one, the greyed last, for a caster with no lore", () => {
    const rows = spellOptions(spells, new Map(), ["", "  "]);
    expect(rows.map((row) => [row.title, row.group])).toEqual([
      ["Age of Stone", undefined],
      ["Angvar's Fury", undefined],
      ["Vision of Torment", undefined],
      ["Fireball", undefined],
      ["Dark Blood", undefined],
    ]);
  });
});
