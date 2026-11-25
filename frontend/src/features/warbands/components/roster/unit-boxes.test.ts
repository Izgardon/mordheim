import { describe, expect, it } from "vitest";

import { panelAfter, pillType } from "./unit-boxes";

describe("pillType", () => {
  it("drops the Warband prefix from a warband's own rule", () => {
    expect(pillType("Warband - Cult of the Possessed")).toBe("Cult of the Possessed");
  });

  it("leaves every other type, and none, as they are", () => {
    expect(pillType("Psychology")).toBe("Psychology");
    expect(pillType(null)).toBe("");
  });
});

describe("panelAfter", () => {
  // William, 25 Nov 2026: on a phone the panel sits under the line of the box tapped
  it("follows the second box of the tapped box's line of two", () => {
    expect(panelAfter(0, 5)).toBe(1);
    expect(panelAfter(1, 5)).toBe(1);
    expect(panelAfter(2, 5)).toBe(3);
    expect(panelAfter(3, 5)).toBe(3);
  });

  it("follows the row's last cell when its line holds one box", () => {
    expect(panelAfter(4, 5)).toBe(4);
    expect(panelAfter(0, 1)).toBe(0);
  });
});
