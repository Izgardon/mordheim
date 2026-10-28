import { describe, expect, it } from "vitest";

import { toParticipantRosters } from "@/features/battles/api/battle-queries";
import { ME, battleRosters, myParticipant, opponentParticipant } from "@/test/battle-fixtures";

import { meleeUnitOptions, rangedUnitOptions } from "./helper-options";

const rosters = toParticipantRosters(battleRosters());
const me = myParticipant({
  unit_information_json: {
    "hero:1": { stats_override: { weapon_skill: 6, ballistic_skill: 2 } },
    "hero:3": { out_of_action: true },
  },
});

describe("helper-options", () => {
  it("lists every warband's units in action for melee, yours apart, with battle stats", () => {
    const options = meleeUnitOptions([me, opponentParticipant()], rosters, ME.id);

    expect(options.yours.map((option) => option.value)).toEqual([
      "7:hero:1",
      "7:henchman:2",
      "7:hireling:4",
    ]);
    expect(options.yours[0]).toMatchObject({
      label: "Captain Wolf (Iron Vultures)",
      defaultWeaponSkill: 6,
      sectionLabel: "Heroes",
    });
    expect(options.others.map((option) => option.value)).toEqual(["9:hero:2"]);
    expect(meleeUnitOptions([me], rosters, undefined)).toEqual({ yours: [], others: [] });
  });

  it("gives a rider his mounted M and save, with a battle stat change winning (step 5)", () => {
    const mine = rosters[ME.id];
    const warhorse = { itemId: 140, name: "Warhorse", hasProfile: true, stats: null };
    const riding = {
      ...rosters,
      [ME.id]: {
        ...mine,
        heroes: mine.heroes.map((hero, index) =>
          index === 0
            ? {
                ...hero,
                mount: { ...warhorse, movement: 8, ratingBonus: 5 },
                effectiveStats: { movement: 8, armour_save: 4 },
              }
            : hero
        ),
      },
    };
    const plain = myParticipant({ unit_information_json: {} });

    expect(rangedUnitOptions(plain, riding)[0].stats).toMatchObject({
      movement: 8,
      armour_save: 4,
    });
    const [melee] = meleeUnitOptions([plain, opponentParticipant()], riding, ME.id).yours;
    expect(melee.stats.armour_save).toBe(4);
    const changed = myParticipant({
      unit_information_json: { "hero:1": { stats_override: { movement: 5 } } },
    });
    expect(rangedUnitOptions(changed, riding)[0].stats).toMatchObject({
      movement: 5,
      armour_save: 4,
    });
  });

  it("lists your own units in action for ranged", () => {
    const options = rangedUnitOptions(me, rosters);

    expect(options.map((option) => [option.value, option.sectionLabel])).toEqual([
      ["hero:1", "Heroes"],
      ["henchman:2", "Henchmen"],
      ["hireling:4", "Hired Swords"],
    ]);
    expect(options[0].defaultBallisticSkill).toBe(2);
    expect(rangedUnitOptions(null, rosters)).toEqual([]);
  });
});
