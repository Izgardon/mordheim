import { describe, expect, it } from "vitest";

import { itemKind, itemKindLine } from "./item-kind";

describe("itemKind", () => {
  // William, 22 Nov 2026: "Subtype shields should have a shield icon"
  it("gives a shield its own kind, and other armour stays armour", () => {
    expect(itemKind({ type: "Armour", subtype: "Shield" })).toBe("shield");
    expect(itemKindLine({ type: "Armour", subtype: "Shield" })).toBe("Shield");
    expect(itemKind({ type: "Armour", subtype: "Body Armour" })).toBe("armour");
    expect(itemKind({ type: "Armour", subtype: "" })).toBe("armour");
  });
});
