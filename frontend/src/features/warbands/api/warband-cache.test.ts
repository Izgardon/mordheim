import { QueryObserver } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { applyWarbandUpdate, isWarbandQuery, mergeById } from "./warband-cache";
import { splitWarbandPatch } from "./warband-queries";
import { queryKeys } from "@/lib/query-keys";
import { createTestQueryClient } from "@/test/query-test-utils";

import type { Query } from "@tanstack/react-query";
import type { Warband } from "../types/warband-types";

const queryWithKey = (queryKey: readonly unknown[]) => ({ queryKey }) as unknown as Query;

describe("warband query keys", () => {
  it("nest under the campaign and, per warband, under one warband prefix", () => {
    const campaign = queryKeys.campaign.all(7);
    const warband = queryKeys.campaign.warband(7, 9);
    const perWarband = [
      queryKeys.campaign.warbandDetail(7, 9),
      queryKeys.campaign.warbandSummary(7, 9),
      queryKeys.campaign.warbandUnits(7, 9, "hero"),
      queryKeys.campaign.warbandStash(7, 9),
    ];
    for (const key of [queryKeys.campaign.myWarband(7), ...perWarband]) {
      expect(key.slice(0, campaign.length)).toEqual([...campaign]);
    }
    for (const key of perWarband) {
      expect(key.slice(0, warband.length)).toEqual([...warband]);
    }
  });
});

describe("isWarbandQuery", () => {
  it("matches one warband's keys in any campaign, narrowed by path", () => {
    const summary = isWarbandQuery(9, "summary");
    expect(summary(queryWithKey(queryKeys.campaign.warbandSummary(7, 9)))).toBe(true);
    expect(summary(queryWithKey(queryKeys.campaign.warbandSummary(3, 9)))).toBe(true);
    expect(summary(queryWithKey(queryKeys.campaign.warbandSummary(7, 10)))).toBe(false);
    expect(summary(queryWithKey(queryKeys.campaign.warbandStash(7, 9)))).toBe(false);
    expect(summary(queryWithKey(queryKeys.campaign.myWarband(7)))).toBe(false);

    const heroes = isWarbandQuery(9, "units", "hero");
    expect(heroes(queryWithKey(queryKeys.campaign.warbandUnits(7, 9, "hero")))).toBe(true);
    expect(heroes(queryWithKey(queryKeys.campaign.warbandUnits(7, 9, "hired_sword")))).toBe(false);
  });
});

describe("mergeById", () => {
  it("drops removed rows, merges incoming rows over cached ones and appends new ones", () => {
    const current = [
      { id: 1, name: "A", xp: 1 },
      { id: 2, name: "B", xp: 2 },
    ];

    expect(
      mergeById(
        current,
        [
          { id: 1, name: "A2", xp: 1 },
          { id: 3, name: "C", xp: 0 },
        ],
        [2]
      )
    ).toEqual([
      { id: 1, name: "A2", xp: 1 },
      { id: 3, name: "C", xp: 0 },
    ]);
    expect(mergeById(current)).toBe(current);
  });
});

describe("splitWarbandPatch", () => {
  it("puts summary fields in the summary part and the rest in the warband part", () => {
    const patch = { name: "Wolves", faction: "Middenheim", gold: 40, rating: 120, resources: [] };

    expect(splitWarbandPatch(patch as Partial<Warband>)).toEqual({
      warband: { name: "Wolves", faction: "Middenheim" },
      summary: { gold: 40, rating: 120, resources: [] },
    });
  });
});

describe("applyWarbandUpdate", () => {
  const seed = () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.campaign.warbandUnits(7, 9, "hero"), [
      { id: 1, name: "Aldric", xp: 3 },
      { id: 2, name: "Gunther", xp: 0 },
    ]);
    queryClient.setQueryData(queryKeys.campaign.warbandStash(7, 9), [{ id: 50, quantity: 1 }]);
    queryClient.setQueryData(queryKeys.campaign.warbandSummary(7, 9), { gold: 100, rating: 90 });
    return queryClient;
  };

  it("merges unit and stash rows and a returned summary into the cache", () => {
    const queryClient = seed();

    applyWarbandUpdate(queryClient, 9, {
      heroes: [{ id: 1, xp: 4 } as never],
      removedHeroIds: [2],
      stashItems: [{ id: 51, quantity: 2 } as never],
      removedStashItemIds: [50],
      summary: { gold: 80 },
    });

    expect(queryClient.getQueryData(queryKeys.campaign.warbandUnits(7, 9, "hero"))).toEqual([
      { id: 1, name: "Aldric", xp: 4 },
    ]);
    expect(queryClient.getQueryData(queryKeys.campaign.warbandStash(7, 9))).toEqual([
      { id: 51, quantity: 2 },
    ]);
    expect(queryClient.getQueryData(queryKeys.campaign.warbandSummary(7, 9))).toEqual({
      gold: 80,
      rating: 90,
    });
  });

  it("refetches the summary only for a page that shows it when no summary came back", async () => {
    const queryClient = seed();
    const summaryKey = queryKeys.campaign.warbandSummary(7, 9);
    const fetchSummary = vi.fn(async () => ({ gold: 70, rating: 90 }));

    // An observer that only reads the summary (like the layout's) does not refetch it.
    const reader = new QueryObserver(queryClient, {
      queryKey: summaryKey,
      queryFn: fetchSummary,
      enabled: false,
    });
    const stopReading = reader.subscribe(() => undefined);
    applyWarbandUpdate(queryClient, 9);
    await vi.waitFor(() => expect(queryClient.isFetching()).toBe(0));
    expect(fetchSummary).not.toHaveBeenCalled();

    // The warband page's observer does.
    const page = new QueryObserver(queryClient, {
      queryKey: summaryKey,
      queryFn: fetchSummary,
      staleTime: Infinity,
    });
    const stopPage = page.subscribe(() => undefined);
    // (Subscribing fetches once: the summary was marked stale above.)
    await vi.waitFor(() => expect(queryClient.isFetching()).toBe(0));
    fetchSummary.mockClear();
    applyWarbandUpdate(queryClient, 9);
    await vi.waitFor(() =>
      expect(queryClient.getQueryData(summaryKey)).toEqual({ gold: 70, rating: 90 })
    );
    expect(fetchSummary).toHaveBeenCalledTimes(1);

    stopReading();
    stopPage();
  });
});
