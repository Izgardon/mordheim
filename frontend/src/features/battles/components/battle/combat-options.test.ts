/**
 * The Melee and Ranged pickers (William, 24 Nov 2026: "for the dropdown for selecting yours and
 * theirs, we only need to show the henchmen group names dont individual"): a henchmen group is one
 * row by its name, and a neutral group one row for each kind of creature in it, by its type.
 */
import { describe, expect, it } from "vitest";

import { toParticipantRosters } from "@/features/battles/api/battle-queries";
import {
  battleRosters,
  ME,
  myParticipant,
  OPPONENT,
  opponentParticipant,
} from "@/test/battle-fixtures";

import { battleSections, battleSides } from "./battle-units";
import { combatOptions } from "./combat-options";

function setUp({ downed = [] as string[] } = {}) {
  const raw = battleRosters();
  const mine = raw[String(ME.id)];
  const [first] = mine.henchmenGroups[0].members;
  mine.henchmenGroups[0].members.push({
    ...first,
    key: "henchman:5",
    id: 5,
    displayName: "Youngblood B",
    stats: { ...first.stats, weapon_skill: 2 },
  });
  const rosters = toParticipantRosters(raw);
  const information = Object.fromEntries(downed.map((key) => [key, { out_of_action: true }]));
  const me = myParticipant({
    selected_unit_keys_json: ["hero:1", "hero:3", "henchman:2", "henchman:5", "hireling:4"],
    unit_information_json: information,
  });
  const creature = (key: string, name: string, type: string, stats: object, status = "standing") =>
    ({ key, name, creature_type: type, stats, max_wounds: 1, status, wounds: 1 }) as const;
  const rat = { weapon_skill: 2, toughness: 3 };
  const neutral = {
    key: "n1",
    name: "Vermin",
    creatures: [
      creature("n1-1", "Giant Rat 1", "Giant Rat", { ...rat, toughness: 9 }, "out_of_action"),
      creature("n1-2", "Giant Rat 2", "Giant Rat", rat),
      creature("n1-3", "Rat Ogre", "Rat Ogre", { strength: 5 }),
    ],
  };
  const sides = battleSides([me, opponentParticipant()], rosters, [neutral as never], ME.id);
  const others = sides.filter((side) => !(side.kind === "warband" && side.mine));
  return combatOptions(battleSections(me, rosters[ME.id]), others, rosters);
}

describe("combatOptions", () => {
  it("lists a henchmen group once, by its name, under Henchmen", () => {
    const { yours } = setUp();

    expect(yours.map((option) => [option.name, option.section])).toEqual([
      ["Captain Wolf", "Heroes"],
      ["Rolf", "Heroes"],
      ["Youngbloods", "Henchmen"],
      ["Ogre Bodyguard", "Hired swords"],
    ]);
    expect(yours.map((option) => option.name)).not.toContain("Youngblood A");
  });

  it("reads a group's profile from its first member still standing", () => {
    const fresh = setUp().yours.find((option) => option.name === "Youngbloods");
    expect(fresh?.stats.weapon_skill).toBe(4);

    const later = setUp({ downed: ["henchman:2"] }).yours.find(
      (option) => option.name === "Youngbloods"
    );
    expect(later?.stats.weapon_skill).toBe(2);
  });

  it("leaves out your models out of action, and a group with nobody standing", () => {
    const { yours } = setUp({ downed: ["hero:3", "henchman:2", "henchman:5"] });

    expect(yours.map((option) => option.name)).toEqual(["Captain Wolf", "Ogre Bodyguard"]);
  });

  it("gives theirs each kind in a neutral group once, under the group's name, with its profile", () => {
    const { theirs } = setUp();

    expect(theirs.map((option) => [option.name, option.section])).toEqual([
      [`Black Fang`, `${OPPONENT.warband.name} · Heroes`],
      ["Giant Rat", "Vermin"],
      ["Rat Ogre", "Vermin"],
    ]);
    // read from the first still standing
    expect(theirs[1].stats).toEqual({ weapon_skill: 2, toughness: 3 });
    expect(theirs[2].stats).toEqual({ strength: 5 });
  });
});
