/**
 * A group anyone may learn from (William, 20 Nov 2026: Animal and Cavalry) is open to every unit
 * without being granted. `for_everyone` cannot stand for that: it is about *warbands*, and is true
 * of each hired sword's private skill list too, so reading it that way would offer every hero all
 * 28 of those lists.
 */
import { describe, expect, it } from "vitest";

import { skillGroup } from "@/test/catalogue-fixtures";
import { skillOption } from "@/features/catalogue/search-options";
import type { Skill } from "./types/skill-types";

import { groupIndex, learnableGroups, unitGroups } from "./skill-groups";

const combat = skillGroup({ id: 10, name: "Combat", skill_ids: [1] });
const animal = skillGroup({ id: 11, name: "Animal", open_to_all: true, skill_ids: [2] });
const hired = skillGroup({
  id: 12,
  name: "Hired Sword - Elf Ranger",
  for_everyone: true,
  skill_ids: [3],
});
const index = groupIndex([combat, animal, hired]);

const ride = { id: 2, name: "Ride [Animal]" } as Skill;
const settings = {} as never;

describe("The groups a unit may learn from", () => {
  it("are his own, then every group open to anyone", () => {
    expect(learnableGroups(index, ["Combat"]).map((group) => group.name)).toEqual([
      "Combat",
      "Animal",
    ]);
  });

  it("leave out a for_everyone group that is only a hired sword's own list", () => {
    expect(learnableGroups(index, ["Combat"]).map((group) => group.name)).not.toContain(
      "Hired Sword - Elf Ranger"
    );
  });

  it("do not repeat a group his access already names", () => {
    expect(learnableGroups(index, ["Combat", "Animal"]).map((group) => group.name)).toEqual([
      "Combat",
      "Animal",
    ]);
  });

  it("are what unitGroups is not: his alone", () => {
    expect(unitGroups(index, ["Combat"]).map((group) => group.name)).toEqual(["Combat"]);
  });
});

describe("A skill from a group anyone may learn from", () => {
  it("carries no 'not open to him' warning", () => {
    const access = learnableGroups(index, ["Combat"]);

    expect(skillOption(ride, { settings, groups: index, access }).warning).toBeFalsy();
  });

  it("warns when only his own groups are counted, which is the bug this fixes", () => {
    const access = unitGroups(index, ["Combat"]);

    expect(skillOption(ride, { settings, groups: index, access }).warning).toBeTruthy();
  });
});
