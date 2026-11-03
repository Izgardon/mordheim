import { describe, expect, it } from "vitest";

import { battleSectionLabel, battleSectionOf, statValues, writtenShown } from "./battle-units";

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
    const unit = { writtenStats: { weapon_skill: "D6", attacks: "1(2)" } };
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
