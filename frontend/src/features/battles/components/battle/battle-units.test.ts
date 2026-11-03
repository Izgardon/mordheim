import { describe, expect, it } from "vitest";

import { battleSectionLabel, battleSectionOf } from "./battle-units";

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
