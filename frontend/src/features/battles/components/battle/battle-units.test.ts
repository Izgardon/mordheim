import { describe, expect, it } from "vitest";

import { DEFAULT_STATS, type PrebattleUnit } from "../prebattle/prebattle-types";
import {
  battleSectionLabel,
  battleSectionOf,
  statValues,
  unitView,
  writtenShown,
} from "./battle-units";

describe("battleSectionOf", () => {
  it("puts a model under its kind's heading", () => {
    expect(battleSectionLabel({ kind: "hero" })).toBe("Heroes");
    expect(battleSectionLabel({ kind: "henchman" })).toBe("Henchmen");
    expect(battleSectionLabel({ kind: "hireling" })).toBe("Hired swords");
    expect(battleSectionLabel({ kind: "pet" })).toBe("Animals");
  });

  it("counts a custom or bestiary model as a temporary unit", () => {
    expect(battleSectionOf({ kind: "custom" })).toBe("temporary");
    expect(battleSectionOf({ kind: "bestiary" })).toBe("temporary");
    expect(battleSectionLabel({ kind: "bestiary" })).toBe("Temporary units");
  });
});

describe("statValues", () => {
  it("shows a written stat as written unless a battle change replaced it", () => {
    const stats = { movement: 4, weapon_skill: null, attacks: 1, armour_save: 5 };
    const unit = { writtenStats: { weapon_skill: "D6", attacks: "(2)" } };
    expect(statValues(stats, writtenShown(unit, []))).toMatchObject({
      M: 4,
      WS: "D6",
      A: "1(2)",
      Sv: "5+",
    });
    expect(statValues({ ...stats, attacks: 3 }, writtenShown(unit, ["attacks"]))).toMatchObject({
      WS: "D6",
      A: 3,
    });
  });
});

describe("unitView", () => {
  const rider = {
    key: "hero:1",
    id: 1,
    kind: "hero",
    displayName: "Aldric",
    unitType: "Knight",
    stats: { ...DEFAULT_STATS, movement: 4, armour_save: 5 },
    mount: { name: "Warhorse", itemId: 7, hasProfile: true, stats: null, ratingBonus: 5 },
    effectiveStats: { movement: 8 },
  } as unknown as PrebattleUnit;

  it("picks out the mount's Move and leaves Sv alone: mounting wrote the save", () => {
    const view = unitView(rider, undefined);

    expect(view.stats.movement).toBe(8);
    expect(view.stats.armour_save).toBe(5);
    expect(view.highlighted).toEqual(["M"]);
    expect(view.mount).toBe("Warhorse");
  });

  it("gives a dismounted model his own Move back, with his stored save", () => {
    const view = unitView(rider, { dismounted: true } as never);

    expect(view.stats.movement).toBe(4);
    expect(view.stats.armour_save).toBe(5);
    expect((view.highlighted as string[]).includes("M")).toBe(false);
    expect(view.dismounted).toBe(true);
  });
});
