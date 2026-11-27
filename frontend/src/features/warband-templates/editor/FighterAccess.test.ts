import { describe, expect, it } from "vitest";

import { randomPicksLine } from "./FighterAccess";

describe("randomPicksLine", () => {
  it("says what a hire picks at random besides his starting spells, prayers for a Priest", () => {
    expect(randomPicksLine("Wizard", 1)).toBe("Plus one random spell at hire.");
    expect(randomPicksLine("Priest", 1)).toBe("Plus one random prayer at hire.");
    expect(randomPicksLine("Wizard", 2)).toBe("Plus 2 random spells at hire.");
  });
});
