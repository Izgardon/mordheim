import { describe, expect, it } from "vitest";

import { firstPick, outsideRange } from "./hero-picks";

describe("firstPick", () => {
  it("picks the first hero whose trading action is unspent", () => {
    const heroes = [
      { id: 1, trading_action: false },
      { id: 2, trading_action: true },
      { id: 3, trading_action: true },
    ];
    expect(firstPick(heroes)).toEqual([2]);
  });

  it("falls back to the first hero, and to nobody without heroes", () => {
    expect(firstPick([{ id: 4, trading_action: false }])).toEqual([4]);
    expect(firstPick([])).toEqual([]);
  });
});

describe("outsideRange", () => {
  it("reads a fixed range", () => {
    const pair = { min_heroes: 2, max_heroes: 2 } as const;
    expect(outsideRange(pair, 1, 5)).toBe(true);
    expect(outsideRange(pair, 2, 5)).toBe(false);
    expect(outsideRange(pair, 3, 5)).toBe(true);
  });

  it("reads all as every hero on the roster", () => {
    expect(outsideRange({ min_heroes: 1, max_heroes: "all" }, 4, 4)).toBe(false);
    expect(outsideRange({ min_heroes: "all", max_heroes: "all" }, 3, 4)).toBe(true);
  });
});
