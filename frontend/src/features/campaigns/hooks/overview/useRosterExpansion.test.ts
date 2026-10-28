import { describe, expect, it } from "vitest";

import { toRosterUnits } from "./useRosterExpansion";

import type { RosterStatsRow } from "@/features/warbands/api/warbands-core";

const row = (id: number, name: string): RosterStatsRow => ({
  id,
  name,
  unit_type: "Warrior",
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
});

describe("toRosterUnits", () => {
  it("lists heroes, then henchmen, then hired swords, with ids unique across the kinds", () => {
    const units = toRosterUnits({
      heroes: [row(1, "Captain Wolf")],
      henchmen_groups: [row(1, "Bowmen")],
      hirelings: [row(1, "Ogre Bodyguard")],
    });

    expect(units.map((unit) => [unit.id, unit.category, unit.name])).toEqual([
      ["hero-1", "Heroes", "Captain Wolf"],
      ["henchmen-1", "Henchmen", "Bowmen"],
      ["hireling-1", "Hired Swords", "Ogre Bodyguard"],
    ]);
    expect(units[0]).toMatchObject({ movement: 4, leadership: 7, armour_save: null });
  });

  it("is empty for a warband with no units on its roster", () => {
    expect(toRosterUnits({ heroes: [], henchmen_groups: [], hirelings: [] })).toEqual([]);
  });
});
