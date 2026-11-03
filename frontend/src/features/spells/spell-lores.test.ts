/**
 * The Spells page's rows (William, 3 Nov 2026: "a row per school with the spells inside the
 * expanded row"): a lore per row, its spells as its D6 table, and a search that keeps only the
 * lores with a match, each with its matches.
 */
import { describe, expect, it } from "vitest";

import { spell } from "@/test/catalogue-fixtures";

import { difficultyRange, loreRowId, spellLores } from "./spell-lores";

const LESSER = "Lesser Magic";
const DEAD = "Necromancy (Restless Dead)";
const fires = spell({ id: 1, name: "Fires of U'Zhul", type: LESSER, roll: 1, dc: 7 });
const curse = spell({ id: 2, name: "Sorcerer's Curse", type: LESSER, roll: 6, dc: 8 });
const arrows = spell({
  id: 3,
  name: "Silver Arrows of Arha",
  type: LESSER,
  roll: 3,
  dc: 7,
  description: "D6+2 arrows of light.",
});
const horror = spell({ id: 4, name: "Living Horror", type: DEAD, roll: null, dc: "8" });
const visage = spell({ id: 5, name: "Deathly Visage", type: DEAD, roll: 6, dc: "6" });
const awakening = spell({ id: 6, name: "Spell of Awakening", type: DEAD, roll: 1, dc: "Auto" });
const SPELLS = [horror, curse, visage, fires, awakening, arrows];

const names = (spells: { name: string }[]) => spells.map((entry) => entry.name);

describe("the lores", () => {
  it("are one per lore by name, each one's spells by roll with no roll last", () => {
    const lores = spellLores(SPELLS, "", null);

    expect(names(lores)).toEqual([LESSER, DEAD]);
    expect(names(lores[0].spells)).toEqual([fires.name, arrows.name, curse.name]);
    expect(names(lores[1].spells)).toEqual([awakening.name, visage.name, horror.name]);
    expect(lores.map(({ matches, total, difficulty }) => ({ matches, total, difficulty }))).toEqual(
      [
        { matches: 3, total: 3, difficulty: "7–8" },
        { matches: 3, total: 3, difficulty: "6–8" },
      ]
    );
  });

  it("while searching keep only the lores with a match, and in them only the matches", () => {
    const byName = spellLores(SPELLS, "fires", null);
    expect(names(byName)).toEqual([LESSER]);
    expect(names(byName[0].spells)).toEqual([fires.name]);
    expect(byName[0]).toMatchObject({ matches: 1, total: 3 });

    // the rules text, and the lore's name (all of its spells)
    expect(names(spellLores(SPELLS, "arrows of light", null)[0].spells)).toEqual([arrows.name]);
    expect(spellLores(SPELLS, "restless", null)).toMatchObject([{ name: DEAD, matches: 3 }]);
    expect(spellLores(SPELLS, "no such spell", null)).toEqual([]);
  });

  it("keep the open spell in its lore while a search leaves it out", () => {
    const lores = spellLores(SPELLS, "fires", String(horror.id));

    expect(names(lores)).toEqual([LESSER, DEAD]);
    expect(names(lores[1].spells)).toEqual([horror.name]);
    expect(lores[1].matches).toBe(0);
  });
});

describe("a lore's row", () => {
  it("reads its difficulties lowest to highest, past the ones cast automatically", () => {
    expect(difficultyRange([awakening, visage, horror])).toBe("6–8");
    expect(difficultyRange([fires])).toBe("7");
    expect(difficultyRange([awakening])).toBe("Auto");
    expect(difficultyRange([spell({ dc: null })])).toBe("");
  });

  it("has a DOM key apart from the spells' ids", () => {
    expect(loreRowId(DEAD)).toBe("lore-necromancy-restless-dead");
  });
});
