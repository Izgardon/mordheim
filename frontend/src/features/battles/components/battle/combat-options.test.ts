/**
 * The Melee and Ranged pickers (William, 24 Nov 2026: "for the dropdown for selecting yours and
 * theirs, we only need to show the henchmen group names dont individual"): a henchmen group and a
 * neutral group are one row each, by the group's name.
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
  const neutral = {
    key: "n1",
    name: "Giant rats",
    creature_type: "Giant Rat",
    stats: { weapon_skill: 2, toughness: 3 },
    creatures: [
      { key: "n1:1", name: "Giant Rat 1", status: "standing" as const },
      { key: "n1:2", name: "Giant Rat 2", status: "standing" as const },
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

  it("gives theirs a neutral group once by its name, with its profile", () => {
    const { theirs } = setUp();

    expect(theirs.map((option) => [option.name, option.section])).toEqual([
      [`Black Fang`, `${OPPONENT.warband.name} · Heroes`],
      ["Giant rats", "Neutral groups"],
    ]);
    expect(theirs[1].stats).toEqual({ weapon_skill: 2, toughness: 3 });
  });
});
