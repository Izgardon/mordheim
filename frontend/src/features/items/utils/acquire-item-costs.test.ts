import { describe, expect, it } from "vitest";

import { getPersistedItemCost } from "./acquire-item-costs";

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

  it("returns null when a non-bought item has no stored cost", () => {
    expect(getPersistedItemCost({ cost: null })).toBeNull();
  });
});
