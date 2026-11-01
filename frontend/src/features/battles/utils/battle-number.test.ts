import { describe, expect, it } from "vitest";

import { battleNumberLabel, numberedOr } from "./battle-number";

describe("battleNumberLabel", () => {
  it("reads Battle N, or nothing for a battle without a number", () => {
    expect(battleNumberLabel(6)).toBe("Battle 6");
    expect(battleNumberLabel(6, "In battle")).toBe("In battle 6");
    expect(battleNumberLabel(null)).toBe("");
    expect(battleNumberLabel(undefined)).toBe("");
  });

  it("falls back when the battle has no number", () => {
    expect(numberedOr(3, "After battle", "After the battle")).toBe("After battle 3");
    expect(numberedOr(null, "After battle", "After the battle")).toBe("After the battle");
  });
});
