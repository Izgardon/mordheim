import { describe, expect, it } from "vitest";

import {
  buildHenchmenPendingChanges,
  buildPendingChanges,
  getPendingSpend,
  removePendingPurchase,
  type PendingPurchase,
} from "./pending-purchases";

const purchase = (overrides: Partial<PendingPurchase> = {}): PendingPurchase => ({
  unitType: "heroes",
  unitId: "11",
  itemId: 101,
  itemName: "Sword",
  quantity: 1,
  unitPrice: 10,
  isBuying: true,
  line: { item_id: 101, quantity: 1, price: 10, availability_id: null, is_buying: true },
  ...overrides,
});

describe("pending purchase helpers", () => {
  it("totals only the purchases being bought", () => {
    const purchases = [purchase({ quantity: 2 }), purchase({ isBuying: false, unitPrice: 50 })];

    expect(getPendingSpend(purchases)).toBe(20);
    expect(buildPendingChanges(purchases)).toEqual([
      { label: "Sword", category: "buy_item", quantity: 2, unitCost: 10, amount: 20 },
    ]);
  });

  it("removes one unit of the latest matching purchase", () => {
    const purchases = [purchase({ quantity: 2 }), purchase({ itemId: 102 })];

    expect(
      removePendingPurchase(purchases, { unitType: "heroes", unitId: "11", itemId: 101 })
    ).toEqual([purchase({ quantity: 1 }), purchase({ itemId: 102 })]);
    expect(
      removePendingPurchase(purchases, { unitType: "heroes", unitId: "11", itemId: 102 })
    ).toEqual([purchase({ quantity: 2 })]);
  });

  it("lists new henchmen and stash items for saved groups as pending changes", () => {
    const changes = buildHenchmenPendingChanges(
      [],
      [
        {
          id: 21,
          name: "Black Knives",
          items: [{ id: 104, name: "Club" }],
          henchmen: [
            { id: 61, name: "Blade One" },
            {
              name: "Blade Four",
              cost: "33",
              itemChoices: [{ itemId: 104, action: "stash" }],
            },
          ],
        },
        { name: "Unsaved group", items: [], henchmen: [{ name: "Ignored", cost: 20 }] },
      ]
    );

    expect(changes).toEqual([
      {
        label: "Blade Four (Black Knives)",
        category: "new_henchman",
        quantity: 1,
        unitCost: 33,
        amount: 33,
      },
      {
        label: "Club (from stash)",
        category: "stash_consume",
        quantity: 1,
        unitCost: 0,
        amount: 0,
      },
    ]);
  });
});
