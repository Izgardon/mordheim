import { describe, expect, it } from "vitest";

import { buildAcquiredItemEntries, getPersistedItemCost } from "../acquire-item-costs";

describe("getPersistedItemCost", () => {
  it("uses base cost for bought items instead of the paid price", () => {
    expect(
      getPersistedItemCost(
        { cost: 99 },
        {
          isBuying: true,
          baseCost: 35,
        }
      )
    ).toBe(35);
  });

  it("keeps the existing stored cost when moving or assigning an item", () => {
    expect(
      getPersistedItemCost(
        { cost: 18 },
        {
          isBuying: false,
          baseCost: 40,
        }
      )
    ).toBe(18);
  });

  it("falls back to the base cost when giving a newly acquired item", () => {
    expect(
      getPersistedItemCost(
        { cost: null },
        {
          isBuying: false,
          baseCost: 40,
        }
      )
    ).toBe(40);
  });

  it("builds repeated acquired-item payload rows using the resolved persisted cost", () => {
    expect(
      buildAcquiredItemEntries(
        12,
        2,
        { cost: null },
        {
          isBuying: false,
          baseCost: 40,
        }
      )
    ).toEqual([
      { id: 12, cost: 40 },
      { id: 12, cost: 40 },
    ]);
  });

  it("returns null when a non-bought item has no stored cost", () => {
    expect(getPersistedItemCost({ cost: null })).toBeNull();
  });
});
