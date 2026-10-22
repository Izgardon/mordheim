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
