import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildHenchmenPendingChanges,
  buildPendingChanges,
  buildPurchaseSteps,
  getPendingSpend,
  removePendingPurchase,
  type PendingPurchase,
} from "./pending-purchases";
import { describeFollowUps, runFollowUps } from "./follow-ups";

const api = vi.hoisted(() => ({
  createWarbandTrade: vi.fn(),
  createWarbandLog: vi.fn(),
}));

vi.mock("@/features/warbands/api/warbands-api", () => api);

const purchase = (overrides: Partial<PendingPurchase> = {}): PendingPurchase => ({
  unitType: "heroes",
  unitId: "11",
  itemId: 101,
  itemName: "Sword",
  quantity: 1,
  unitPrice: 10,
  isBuying: true,
  ...overrides,
});

const resolveName = () => "Aldric the Bold";

/** Runs a Save's purchase steps one by one, as the save's follow-ups do. */
const commitPendingPurchases = async (...args: Parameters<typeof buildPurchaseSteps>) => {
  for (const step of buildPurchaseSteps(...args)) {
    await step.run();
  }
};

/** Records every request in the order it was sent, as `trade:<description>` / `log:<item>`. */
const recordCalls = () => {
  const calls: string[] = [];
  let nextId = 500;
  api.createWarbandTrade.mockImplementation(async (_id: number, body: { description: string }) => {
    calls.push(`trade:${body.description}`);
    nextId += 1;
    return { id: nextId };
  });
  api.createWarbandLog.mockImplementation(
    async (_id: number, body: { payload: { item: string } }) => {
      calls.push(`log:${body.payload.item}`);
      return {};
    }
  );
  return calls;
};

describe("buildPurchaseSteps (ROST-TEST-21)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes one Bought trade and one loadout log for a single purchase, with no group header", async () => {
    const calls = recordCalls();

    await commitPendingPurchases(9, [purchase()], resolveName);

    expect(calls).toEqual(["trade:Sword", "log:Sword"]);
    expect(api.createWarbandTrade).toHaveBeenCalledWith(9, {
      action: "Bought",
      description: "Sword",
      price: 10,
      parent_id: null,
    });
    expect(api.createWarbandLog).toHaveBeenCalledWith(9, {
      feature: "loadout",
      entry_type: "hero_item",
      payload: { hero: "Aldric the Bold", item: "Sword", price: 10 },
    });
  });

  it("sends a group header first, then a trade and a log per entry, one request at a time", async () => {
    const calls = recordCalls();

    await commitPendingPurchases(
      9,
      [
        purchase(),
        purchase({ itemId: 102, itemName: "Dagger", quantity: 2, unitPrice: 2 }),
        purchase({ itemId: 103, itemName: "Rope", isBuying: false, reason: " Found it " }),
      ],
      resolveName
    );

    expect(calls).toEqual([
      "trade:Equipped Aldric the Bold (2 items, 14 gc)",
      "trade:Sword",
      "log:Sword",
      "trade:Dagger x 2",
      "log:Dagger",
      "log:Rope",
    ]);
    expect(api.createWarbandTrade.mock.calls[0][1]).toEqual({
      action: "Group",
      description: "Equipped Aldric the Bold (2 items, 14 gc)",
      price: 0,
    });
    expect(api.createWarbandTrade.mock.calls[2][1]).toEqual({
      action: "Bought",
      description: "Dagger x 2",
      price: 4,
      parent_id: 501,
    });
    expect(api.createWarbandLog.mock.calls[1][1].payload).toEqual({
      hero: "Aldric the Bold",
      item: "Dagger",
      price: 4,
      quantity: 2,
    });
    expect(api.createWarbandLog.mock.calls[2][1].payload).toEqual({
      hero: "Aldric the Bold",
      item: "Rope",
      reason: "Found it",
    });
  });

  it("logs a free item without a trade or price", async () => {
    const calls = recordCalls();

    await commitPendingPurchases(9, [purchase({ unitPrice: 0 })], resolveName);

    expect(calls).toEqual(["log:Sword"]);
    expect(api.createWarbandLog.mock.calls[0][1].payload).toEqual({
      hero: "Aldric the Bold",
      item: "Sword",
    });
  });

  it.each([
    ["heroes", "hero_item"],
    ["henchmen", "henchmen_item"],
    ["hiredswords", "hired_sword_item"],
  ] as const)(
    "logs a %s purchase as %s, still naming the unit under `hero`",
    async (unitType, entryType) => {
      recordCalls();

      await commitPendingPurchases(9, [purchase({ unitType })], () => "Unit");

      expect(api.createWarbandLog.mock.calls[0][1]).toMatchObject({
        entry_type: entryType,
        payload: { hero: "Unit" },
      });
    }
  );

  it("waits for each request before sending the next", async () => {
    let releaseFirst!: (value: { id: number }) => void;
    api.createWarbandTrade.mockImplementationOnce(
      () => new Promise((resolve) => (releaseFirst = resolve))
    );
    api.createWarbandLog.mockResolvedValue({});

    const pending = commitPendingPurchases(9, [purchase()], resolveName);
    await Promise.resolve();

    expect(api.createWarbandTrade).toHaveBeenCalledTimes(1);
    expect(api.createWarbandLog).not.toHaveBeenCalled();

    releaseFirst({ id: 1 });
    await pending;
    expect(api.createWarbandLog).toHaveBeenCalledTimes(1);
  });

  it("stops at the first failure and leaves the earlier writes in place (not atomic)", async () => {
    const calls = recordCalls();
    api.createWarbandTrade
      .mockImplementationOnce(async (_id: number, body: { description: string }) => {
        calls.push(`trade:${body.description}`);
        return { id: 501 };
      })
      .mockImplementationOnce(async (_id: number, body: { description: string }) => {
        calls.push(`trade:${body.description}`);
        return { id: 502 };
      })
      .mockRejectedValueOnce(new Error("Server error"));

    await expect(
      commitPendingPurchases(
        9,
        [
          purchase(),
          purchase({ itemId: 102, itemName: "Dagger", unitPrice: 2 }),
          purchase({ itemId: 103, itemName: "Shield", unitPrice: 5 }),
        ],
        resolveName
      )
    ).rejects.toThrow("Server error");

    expect(calls).toEqual([
      "trade:Equipped Aldric the Bold (3 items, 17 gc)",
      "trade:Sword",
      "log:Sword",
    ]);
  });
});

describe("purchase steps after a failure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("names what is left and retries only that, under the same header", async () => {
    const calls = recordCalls();
    api.createWarbandLog.mockRejectedValueOnce(new Error("Server error"));
    const steps = buildPurchaseSteps(
      9,
      [purchase(), purchase({ itemId: 102, itemName: "Dagger", unitPrice: 2 })],
      resolveName
    );

    const first = await runFollowUps(steps);
    expect(first.error).toEqual(new Error("Server error"));
    expect(describeFollowUps(first.remaining)).toBe(
      "the loadout log for Sword (Aldric the Bold), buying Dagger (2 gc), the loadout log for Dagger (Aldric the Bold)"
    );

    const retry = await runFollowUps(first.remaining);
    expect(retry.remaining).toEqual([]);
    // The header and the Sword trade went once; the Dagger trade still hangs off the header.
    expect(calls).toEqual([
      "trade:Equipped Aldric the Bold (2 items, 12 gc)",
      "trade:Sword",
      "log:Sword",
      "trade:Dagger",
      "log:Dagger",
    ]);
    expect(api.createWarbandTrade).toHaveBeenLastCalledWith(9, {
      action: "Bought",
      description: "Dagger",
      price: 2,
      parent_id: 501,
    });
  });

  it("sends nothing past a failed group header, and the retry starts with the header", async () => {
    const calls = recordCalls();
    api.createWarbandTrade.mockRejectedValueOnce(new Error("Server error"));
    const steps = buildPurchaseSteps(
      9,
      [purchase(), purchase({ itemId: 102, itemName: "Dagger", unitPrice: 2 })],
      resolveName
    );

    const first = await runFollowUps(steps);
    expect(calls).toEqual([]);
    expect(first.remaining).toHaveLength(steps.length);

    await runFollowUps(first.remaining);
    expect(calls).toEqual([
      "trade:Equipped Aldric the Bold (2 items, 12 gc)",
      "trade:Sword",
      "log:Sword",
      "trade:Dagger",
      "log:Dagger",
    ]);
    // The retried header's id (the second trade the server answered) parents the rest.
    expect(api.createWarbandTrade).toHaveBeenLastCalledWith(9, {
      action: "Bought",
      description: "Dagger",
      price: 2,
      parent_id: 501,
    });
  });

  it("names only the first buyer in the group header when the purchases span units", async () => {
    const calls = recordCalls();
    const names: Record<string, string> = { "11": "Aldric", "12": "Gunther" };

    await commitPendingPurchases(
      9,
      [purchase(), purchase({ unitId: "12", itemId: 102, itemName: "Dagger", unitPrice: 2 })],
      (entry) => names[entry.unitId]
    );

    expect(calls[0]).toBe("trade:Equipped Aldric (2 items, 12 gc)");
    expect(api.createWarbandLog.mock.calls[1][1].payload).toEqual({
      hero: "Gunther",
      item: "Dagger",
      price: 2,
    });
  });
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
