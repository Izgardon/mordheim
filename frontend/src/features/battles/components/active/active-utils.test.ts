import { describe, expect, it } from "vitest";

import type { PrebattleUnit } from "@/features/battles/components/prebattle/prebattle-types";

import { getCurrentUnitWounds, setUnitCurrentWounds, toUnitInformationMap } from "./active-utils";

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
    for (const kind of ["hero", "hireling", "henchman", "custom"] as const) {
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

  it("keeps a unit with a kill but no recorded wounds at its full wounds, so +/- work from there (BUG-128)", () => {
    const unit = createUnit("hero");
    // What the server stores after a kill on an untouched unit: no wounds recorded yet.
    const fromServer = toUnitInformationMap({
      [unit.key]: {
        stats_override: {},
        notes: "",
        current_wounds: null,
        out_of_action: false,
        kill_count: 1,
      },
    });

    expect(fromServer[unit.key].current_wounds).toBeNull();
    expect(getCurrentUnitWounds(unit, fromServer[unit.key])).toBe(2);

    const hurt = setUnitCurrentWounds(fromServer, unit, 1);
    expect(getCurrentUnitWounds(unit, hurt[unit.key])).toBe(1);
    // Back to full stores null again (the whole blob sent to /config/), never 0.
    const healed = setUnitCurrentWounds(toUnitInformationMap(hurt), unit, 2);
    expect(healed[unit.key]).toMatchObject({ current_wounds: null, kill_count: 1 });
    expect(getCurrentUnitWounds(unit, toUnitInformationMap(healed)[unit.key])).toBe(2);
  });

  it("reads recorded wounds sent as numbers or numeric text, and anything else as none", () => {
    const entry = (current_wounds: unknown) =>
      toUnitInformationMap({ "hero:1": { current_wounds, kill_count: 1 } })["hero:1"]
        .current_wounds;

    expect([entry(0), entry(3), entry("2"), entry(-1)]).toEqual([0, 3, 2, 0]);
    expect([entry(null), entry(undefined), entry(""), entry("x")]).toEqual([
      null,
      null,
      null,
      null,
    ]);
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
