import { describe, expect, it } from "vitest";

import { applyPurchaseAnswer, purchaseLine, type PurchaseAnswer } from "./purchase";
import { queryKeys } from "@/lib/query-keys";
import { createTestQueryClient } from "@/test/query-test-utils";
import { makeItem } from "@/test/warband-fixtures";

import type { AcquireItemMeta } from "../types/acquire-types";

const rope = makeItem({
  id: 120,
  name: "Rope",
  cost: null,
  availabilities: [{ id: 7, cost: 5, rarity: 2, restrictions: [] }],
});

const buying: AcquireItemMeta = {
  isBuying: true,
  quantity: 2,
  unitPrice: 6,
  totalPrice: 12,
  reason: "",
  baseCost: 5,
};

describe("purchaseLine", () => {
  it("prices one copy when buying, with the availability chosen", () => {
    expect(purchaseLine({ item: rope, meta: buying, availabilityId: 7 })).toEqual({
      item_id: 120,
      quantity: 2,
      price: 6,
      availability_id: 7,
      is_buying: true,
    });
  });

  it("gives a copy its resale cost and the reason", () => {
    expect(
      purchaseLine({
        item: rope,
        meta: { ...buying, isBuying: false, quantity: 1, reason: " Found " },
      })
    ).toEqual({
      item_id: 120,
      quantity: 1,
      price: 5,
      availability_id: null,
      is_buying: false,
      reason: "Found",
    });
  });

  it("sends no price at the campaign's current price (Buy again), and a roll when there is one", () => {
    const roll = { hero_id: 11, roll: 9, modifier: 1, rarity: "9", success: true };
    expect(
      purchaseLine({ item: rope, meta: buying, atCurrentPrice: true, rarityRoll: roll })
    ).toEqual({ item_id: 120, quantity: 2, is_buying: true, rarity_roll: roll });
  });
});

describe("applyPurchaseAnswer", () => {
  const answer = (overrides: Partial<PurchaseAnswer>): PurchaseAnswer => ({
    target_type: "stash",
    target_id: null,
    updated_at: null,
    items: null,
    stash_item: null,
    trade: null,
    summary: { gold: 80 },
    warnings: [],
    ...overrides,
  });

  it("puts the unit's new items and version, the gold and the Buy row in the cache", () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.campaign.warbandSheet(7, 9), {
      warband: {},
      summary: { gold: 100 },
      heroes: [{ id: 11, name: "Aldric", items: [] }],
      henchmen_groups: [],
      hired_swords: [],
    });
    queryClient.setQueryData(queryKeys.campaign.warbandTreasury(7, 9), []);
    const row = { id: 3, action: "Buy", price: -20 } as PurchaseAnswer["trade"];

    applyPurchaseAnswer(
      queryClient,
      9,
      answer({
        target_type: "hero",
        target_id: 11,
        items: [rope],
        updated_at: "2026-10-18T10:00:00Z",
        trade: row,
      })
    );

    expect(queryClient.getQueryData(queryKeys.campaign.warbandSheet(7, 9))).toMatchObject({
      summary: { gold: 80 },
      heroes: [{ id: 11, name: "Aldric", items: [rope], updated_at: "2026-10-18T10:00:00Z" }],
    });
    expect(queryClient.getQueryData(queryKeys.campaign.warbandTreasury(7, 9))).toEqual([row]);
  });

  it("merges the stash entry into the cached stash", () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.campaign.warbandStash(7, 9), [
      { id: 120, name: "Rope", cost: 5, quantity: 1 },
    ]);

    applyPurchaseAnswer(
      queryClient,
      9,
      answer({ stash_item: { id: 120, name: "Rope", cost: 5, quantity: 3 } as never })
    );

    expect(queryClient.getQueryData(queryKeys.campaign.warbandStash(7, 9))).toEqual([
      { id: 120, name: "Rope", cost: 5, quantity: 3 },
    ]);
  });
});
