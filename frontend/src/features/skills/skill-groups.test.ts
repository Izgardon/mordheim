import { describe, expect, it } from "vitest";

import { skillGroup } from "@/test/catalogue-fixtures";

import { cameThrough, groupIndex, groupsOf, isCore, unitGroups } from "./skill-groups";

const combat = skillGroup({
  id: 1,
  name: "Close Combat",
  access_name: "Combat",
  skill_ids: [10, 11],
});
const speed = skillGroup({ id: 2, name: "Speed", skill_ids: [11] });
const dwarves = skillGroup({ id: 3, name: "Dwarves", for_everyone: false, skill_ids: [11, 12] });
const index = groupIndex([combat, speed, dwarves]);

describe("skill groups", () => {
  it("lists the groups holding a skill in group order", () => {
    expect(groupsOf(index, 11)).toEqual([combat, speed, dwarves]);
    expect(groupsOf(index, 99)).toEqual([]);
  });

  it("finds a unit's groups by the names his access stores, a renamed version by its book name", () => {
    expect(unitGroups(index, ["dwarves", " combat ", "Gone", "Dwarves"])).toEqual([
      dwarves,
      combat,
    ]);
    expect(isCore(combat)).toBe(true);
    expect(isCore(dwarves)).toBe(false);
  });

  it("shows a skill under the first of his groups holding it, else its first group", () => {
    expect(cameThrough(index, 11, [dwarves, combat])).toBe(dwarves);
    expect(cameThrough(index, 11, [])).toBe(combat);
    expect(cameThrough(index, 12, [combat])).toBe(dwarves);
    expect(cameThrough(index, 99, [combat])).toBeUndefined();
  });
});
