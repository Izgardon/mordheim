import { describe, expect, it } from "vitest";

import type { PrebattleUnit } from "@/features/battles/components/prebattle/prebattle-types";

import { getCurrentUnitWounds, setUnitCurrentWounds } from "../active-utils";

function createUnit(
  kind: PrebattleUnit["kind"],
  overrides: Partial<PrebattleUnit> = {}
): PrebattleUnit {
  return {
    key: `${kind}:1`,
    id: 1,
    kind,
    displayName: "Unit One",
    unitType: "Warrior",
    stats: {
      movement: 4,
      weapon_skill: 4,
      ballistic_skill: 4,
      strength: 3,
      toughness: 3,
      wounds: 2,
      initiative: 4,
      attacks: 1,
      leadership: 7,
      armour_save: null,
    },
    ...overrides,
  };
}

describe("active-utils wounds handling", () => {
  it("prefers current_wounds over stats_override wounds for all unit kinds", () => {
    for (const kind of ["hero", "hired_sword", "henchman", "custom"] as const) {
      const unit = createUnit(kind);
      expect(
        getCurrentUnitWounds(unit, {
          stats_override: { wounds: 1 },
          current_wounds: 3,
          notes: "",
          out_of_action: false,
          kill_count: 0,
        })
      ).toBe(3);
    }
  });

  it("stores transient battle wounds in current_wounds without clearing stat overrides", () => {
    const unit = createUnit("hero");
    const next = setUnitCurrentWounds(
      {
        [unit.key]: {
          stats_override: { strength: 4, wounds: 1 },
          current_wounds: null,
          notes: "Keep pressure",
          out_of_action: false,
          kill_count: 2,
        },
      },
      unit,
      5
    );

    expect(next[unit.key]).toEqual({
      stats_override: { strength: 4, wounds: 1 },
      current_wounds: 5,
      notes: "Keep pressure",
      out_of_action: false,
      kill_count: 2,
    });
  });
});
