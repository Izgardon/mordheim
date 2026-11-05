import { describe, expect, it } from "vitest";

import type { PrebattleUnit } from "@/features/battles/components/prebattle/prebattle-types";

import { groupRolls, rollReading, unitRolls } from "./prebattle-rolls";

const WOUND = "On a 1 on a D6 at the start of any battle he can't fight.";

const unit = (fields: Partial<PrebattleUnit>): PrebattleUnit => ({
  key: "hero:1",
  id: 1,
  kind: "hero",
  displayName: "Gunther",
  unitType: "Champion",
  stats: {
    movement: 4,
    weapon_skill: 3,
    ballistic_skill: 3,
    strength: 3,
    toughness: 3,
    wounds: 1,
    initiative: 3,
    attacks: 1,
    leadership: 7,
    armour_save: null,
  },
  ...fields,
});

describe("A unit's pre-battle rolls", () => {
  it("are his specials', skills' and carried items' rules with a roll, an own rule named by its item", () => {
    const hero = unit({
      specials: [
        { id: 3, name: "Hardened" },
        { id: 4, name: "Old Battle Wound", prebattleRoll: "D6", prebattleText: WOUND },
      ],
      skills: [{ id: 5, name: "Spy", prebattleRoll: "D3", prebattleText: "Re-deploy D3." }],
      items: [
        { id: 7, name: "Sword", count: 1, singleUse: false },
        {
          id: 8,
          name: "Jester Mask",
          count: 1,
          singleUse: false,
          prebattleRolls: [{ rule: "Grin", roll: "D6", text: "On a 1, stupid." }],
        },
        {
          id: 9,
          name: "Evil Jester Mask",
          count: 1,
          singleUse: false,
          prebattleRolls: [{ rule: null, roll: "D6", text: "On a 6, frenzy." }],
        },
      ],
    });
    expect(unitRolls(hero)).toEqual([
      { key: "special:4", source: "Old Battle Wound", dice: "D6", text: WOUND },
      { key: "skill:5", source: "Spy", dice: "D3", text: "Re-deploy D3." },
      { key: "item:8:0", source: "Grin (Jester Mask)", dice: "D6", text: "On a 1, stupid." },
      { key: "item:9:0", source: "Evil Jester Mask", dice: "D6", text: "On a 6, frenzy." },
    ]);
  });

  it("leave out dice the dice boxes can't read", () => {
    const hero = unit({ specials: [{ id: 4, name: "Odd", prebattleRoll: "D6+1" }] });
    expect(unitRolls(hero)).toEqual([]);
  });

  it("are a henchmen group's once, whichever members carry them", () => {
    const wound = { id: 4, name: "Old Battle Wound", prebattleRoll: "D6", prebattleText: WOUND };
    const mask = {
      id: 8,
      name: "Jester Mask",
      count: 1,
      singleUse: false,
      prebattleRolls: [{ rule: "Grin", roll: "D6", text: "On a 1, stupid." }],
    };
    const members = [
      unit({ key: "henchman:1", kind: "henchman", specials: [wound], items: [] }),
      unit({ key: "henchman:2", kind: "henchman", specials: [wound], items: [mask] }),
      unit({ key: "henchman:3", kind: "henchman", specials: [wound], items: [mask] }),
    ];
    expect(groupRolls(members).map((roll) => roll.source)).toEqual([
      "Old Battle Wound",
      "Grin (Jester Mask)",
    ]);
  });
});

describe("What a roll's faces read", () => {
  it("is their sum, or a D66's tens and units", () => {
    expect(rollReading("2D6", [3, 4])).toBe(7);
    expect(rollReading("D6", [5])).toBe(5);
    expect(rollReading("D66", [3, 4])).toBe(34);
  });
});
