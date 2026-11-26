/** A unit's spells under "Prayers" and "Spells" (William, 26 Nov 2026), the picks still to make under his kind. */
import { describe, expect, it } from "vitest";

import { spell } from "@/test/catalogue-fixtures";

import { spellSections } from "./spell-sections";

const soulfire = spell({ id: 1, name: "Soulfire", type: "Prayers of Sigmar", is_prayer: true });
const fires = spell({ id: 2, name: "Fires of U'Zhul" });
const shape = (sections: ReturnType<typeof spellSections>) =>
  sections.map((section) => [section.label, section.spells.length, section.picks]);

describe("a unit's spell sections", () => {
  it("are one for each kind he has, his picks under Spells unless he only prays", () => {
    expect(shape(spellSections([soulfire, fires], 1, false))).toEqual([
      ["Prayers", 1, false],
      ["Spells", 1, true],
    ]);
    expect(shape(spellSections([soulfire], 1, true))).toEqual([["Prayers", 1, true]]);
    expect(shape(spellSections([], 2, true))).toEqual([["Prayers", 0, true]]);
    expect(shape(spellSections([], 0, false))).toEqual([]);
  });
});
