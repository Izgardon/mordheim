import { describe, expect, it } from "vitest";

import {
  patchSheetResources,
  prependTreasuryRow,
  readTradeData,
  setTradeData,
  tradeQuery,
  warbandLogsQuery,
  warbandStashQuery,
  warbandTreasuryQuery,
} from "./economy-queries";
import { queryKeys } from "@/lib/query-keys";
import { createTestQueryClient } from "@/test/query-test-utils";

import type { TradeRequest } from "../types/trade-request-types";
import type { WarbandSheet } from "../types/warband-sheet";
import type { WarbandTrade } from "../types/warband-types";

const row = (id: number, description: string): WarbandTrade => ({
  id,
  warband_id: 9,
  parent_id: null,
  action: "Buy",
  description,
  price: 5,
  notes: "",
  children: [],
  created_at: "2026-10-17T10:00:00Z",
  updated_at: "2026-10-17T10:00:00Z",
});

describe("economy query keys", () => {
  it("nest the stash, the ledger and the logs under the warband's prefix", () => {
    const warband = queryKeys.campaign.warband(7, 9);
    const keys = {
      stash: queryKeys.campaign.warbandStash(7, 9),
      treasury: queryKeys.campaign.warbandTreasury(7, 9),
      logs: queryKeys.campaign.warbandLogs(7, 9),
    };
    for (const [name, key] of Object.entries(keys)) {
      expect(key).toEqual([...warband, name]);
    }
  });

  it("give each read its key", () => {
    expect(warbandTreasuryQuery(7, 9).queryKey).toEqual(queryKeys.campaign.warbandTreasury(7, 9));
    expect(warbandLogsQuery(7, 9).queryKey).toEqual(queryKeys.campaign.warbandLogs(7, 9));
    expect(warbandStashQuery(7, 9).queryKey).toEqual(queryKeys.campaign.warbandStash(7, 9));
  });

  it("read the ledger and the logs on every visit, and keep the stash while it is closed", () => {
    for (const read of [warbandTreasuryQuery(7, 9), warbandLogsQuery(7, 9)]) {
      expect(read).toMatchObject({ staleTime: 0, gcTime: 0, retry: false });
    }
    expect(warbandStashQuery(7, 9).staleTime).toBe(0);
    expect(warbandStashQuery(7, 9)).not.toHaveProperty("gcTime");
  });
});

describe("prependTreasuryRow", () => {
  it("puts a new row on top of every cached ledger of the warband, and of no other", () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.campaign.warbandTreasury(7, 9), [row(1, "Rope")]);
    queryClient.setQueryData(queryKeys.campaign.warbandTreasury(7, 12), [row(2, "Sword")]);

    prependTreasuryRow(queryClient, 9, row(3, "Lantern"));

    expect(
      queryClient
        .getQueryData<WarbandTrade[]>(queryKeys.campaign.warbandTreasury(7, 9))
        ?.map((entry) => entry.description)
    ).toEqual(["Lantern", "Rope"]);
    expect(
      queryClient.getQueryData<WarbandTrade[]>(queryKeys.campaign.warbandTreasury(7, 12))
    ).toEqual([row(2, "Sword")]);
  });

  it("creates no ledger that isn't cached", () => {
    const queryClient = createTestQueryClient();

    prependTreasuryRow(queryClient, 9, row(3, "Lantern"));

    expect(queryClient.getQueryData(queryKeys.campaign.warbandTreasury(7, 9))).toBeUndefined();
  });
});

describe("the trade query", () => {
  const trade = { id: "t-1", campaign_id: 7, status: "accepted" } as TradeRequest;

  it("sits under the campaign, keyed by the request id", () => {
    expect(queryKeys.campaign.trade(7, "t-1")).toEqual([
      ...queryKeys.campaign.all(7),
      "trade",
      "t-1",
    ]);
    expect(tradeQuery(7, "t-1").queryKey).toEqual(queryKeys.campaign.trade(7, "t-1"));
  });

  it("is never stale but is read once per mount, with no retry", () => {
    expect(tradeQuery(7, "t-1")).toMatchObject({
      staleTime: Infinity,
      refetchOnMount: "always",
      retry: false,
    });
  });

  it("takes a write's answer or an event's payload under its own key", () => {
    const queryClient = createTestQueryClient();

    setTradeData(queryClient, trade);

    expect(queryClient.getQueryData(queryKeys.campaign.trade(7, "t-1"))).toEqual(trade);
    expect(readTradeData(queryClient, 7, "t-1")).toEqual(trade);
    expect(readTradeData(queryClient, 7, "t-2")).toBeUndefined();
  });
});

describe("patchSheetResources", () => {
  const treasure = { id: 3, warband_id: 9, name: "Treasure", amount: 2 };
  const sheetWith = (summary: object, warband: object = {}) =>
    ({
      warband,
      summary,
      capabilities: {},
      heroes: [],
      henchmen_groups: [],
      hired_swords: [],
    }) as unknown as WarbandSheet;
  const resourcesOf = (queryClient: ReturnType<typeof createTestQueryClient>) =>
    queryClient.getQueryData<WarbandSheet>(queryKeys.campaign.warbandSheet(7, 9))?.summary
      .resources;

  it("changes the resources in the summary the page reads", () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(
      queryKeys.campaign.warbandSheet(7, 9),
      sheetWith({ gold: 5, resources: [treasure] })
    );

    patchSheetResources(queryClient, 9, (resources) =>
      resources.map((entry) => ({ ...entry, amount: entry.amount + 1 }))
    );

    expect(resourcesOf(queryClient)).toEqual([{ ...treasure, amount: 3 }]);
  });

  it("starts from the warband's resources when the summary has none", () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(
      queryKeys.campaign.warbandSheet(7, 9),
      sheetWith({ gold: 5 }, { resources: [treasure] })
    );

    patchSheetResources(queryClient, 9, (resources) => resources.filter((entry) => entry.id !== 3));

    expect(resourcesOf(queryClient)).toEqual([]);
  });
});
