import { describe, expect, it } from "vitest";

import {
  buildHenchmenOptions,
  buildLevelUpPayload,
  needsHero1d6Followup,
  parseRollTotal,
  resolveHenchmanFromGroup,
  resolveHenchmen2d6Stat,
  resolveHero1d6Stat,
  resolveHero2d6Stat,
} from "./levelup-utils";

import { makeVeteranHenchmenGroup } from "@/test/warband-fixtures";

describe("hero and hired sword advance table", () => {
  it.each([
    [2, "Skill"],
    [5, "Skill"],
    [7, "WS"],
    [10, "Skill"],
    [12, "Skill"],
  ])("2d6 = %i gives %s", (total, stat) => {
    expect(resolveHero2d6Stat(total)).toBe(stat);
    expect(needsHero1d6Followup(total)).toBe(false);
  });

  it.each([
    [6, 3, "S"],
    [6, 4, "A"],
    [8, 1, "I"],
    [8, 6, "Ld"],
    [9, 2, "W"],
    [9, 5, "T"],
  ])("2d6 = %i needs a 1d6 follow-up; 1d6 = %i gives %s", (total, d6, stat) => {
    expect(resolveHero2d6Stat(total)).toBeNull();
    expect(needsHero1d6Followup(total)).toBe(true);
    expect(resolveHero1d6Stat(total, d6)).toBe(stat);
  });
});

describe("henchmen advance table", () => {
  it.each([
    [2, "I"],
    [4, "I"],
    [5, "S"],
    [6, "WS"],
    [7, "WS"],
    [8, "A"],
    [9, "Ld"],
  ])("2d6 = %i gives %s", (total, stat) => {
    expect(resolveHenchmen2d6Stat(total)).toEqual({ stat, ladsGotTalent: false });
  });

  it.each([10, 11, 12])("2d6 = %i is Lad's Got Talent", (total) => {
    expect(resolveHenchmen2d6Stat(total)).toEqual({ stat: null, ladsGotTalent: true });
  });
});

describe("parseRollTotal", () => {
  it("sums dice values in any of the shapes the dice roller produces", () => {
    expect(parseRollTotal([3, 4])).toBe(7);
    expect(parseRollTotal([{ value: 2 }, { value: 6 }])).toBe(8);
    expect(parseRollTotal({ rolls: [{ value: 1 }, 5] })).toBe(6);
    expect(parseRollTotal([])).toBeNull();
    expect(parseRollTotal(null)).toBeNull();
  });
});

describe("buildLevelUpPayload", () => {
  it("names the unit under `hero` and labels the advance", () => {
    expect(
      buildLevelUpPayload({
        unitName: "Brother Hal",
        selectedStat: "Ld",
        roll2d6Total: 8,
        roll1d6Total: 5,
      })
    ).toEqual({
      hero: "Brother Hal",
      advance: { id: "Ld", label: "Leadership" },
      roll1: { dice: "2d6", result: { total: 8 } },
      roll2: { dice: "1d6", result: { total: 5 } },
    });
  });

  it("omits rolls that weren't made", () => {
    expect(
      buildLevelUpPayload({ unitName: "Aldric", selectedStat: "Skill", roll2d6Total: null })
    ).toEqual({ hero: "Aldric", advance: { id: "Skill", label: "Skill" } });
  });
});

describe("Lad's Got Talent helpers", () => {
  const group = makeVeteranHenchmenGroup();

  it("offers every member by id, falling back to a numbered label", () => {
    const options = buildHenchmenOptions({
      ...group,
      henchmen: [...group.henchmen, { id: 64, name: " ", kills: 0, dead: false }],
    });

    expect(options).toEqual([
      { id: "61", label: "Blade One" },
      { id: "62", label: "Blade Two" },
      { id: "63", label: "Blade Three" },
      { id: "64", label: "Henchman 4" },
    ]);
    expect(resolveHenchmanFromGroup(group, "62")).toMatchObject({
      index: 1,
      henchman: { name: "Blade Two" },
    });
    expect(resolveHenchmanFromGroup(group, "99")).toBeNull();
  });
});
