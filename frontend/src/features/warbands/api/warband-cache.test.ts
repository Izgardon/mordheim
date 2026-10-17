import { QueryObserver } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { applyWarbandUpdate, isWarbandQuery, mergeById } from "./warband-cache";
import { mergeSheetWarband, sheetWarband, splitWarbandPatch } from "./warband-queries";
import { queryKeys } from "@/lib/query-keys";
import { createTestQueryClient } from "@/test/query-test-utils";

import type { Query } from "@tanstack/react-query";
import type { WarbandSheet } from "../types/warband-sheet";
import type { Warband } from "../types/warband-types";

const api = vi.hoisted(() => ({ getWarbandSummary: vi.fn() }));
vi.mock("./warbands-api", () => api);

const queryWithKey = (queryKey: readonly unknown[]) => ({ queryKey }) as unknown as Query;

const capabilities = {
  edit: true,
  level_up: true,
  manage_items: true,
  edit_backstory: true,
  delete: true,
  add_custom: false,
};

const makeSheet = (): WarbandSheet =>
  ({
    warband: { id: 9, name: "Wolves", faction: "Middenheim" },
    summary: { gold: 100, rating: 90 },
    capabilities,
    heroes: [
      { id: 1, name: "Aldric", xp: 3 },
      { id: 2, name: "Gunther", xp: 0 },
    ],
    henchmen_groups: [{ id: 5, name: "Knives", xp: 1 }],
    hired_swords: [],
  }) as unknown as WarbandSheet;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("warband query keys", () => {
  it("nest under the campaign and, per warband, under one warband prefix", () => {
    const campaign = queryKeys.campaign.all(7);
    const warband = queryKeys.campaign.warband(7, 9);
    const perWarband = [
      queryKeys.campaign.warbandSheet(7, 9),
      queryKeys.campaign.warbandSummary(7, 9),
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
    const sheet = isWarbandQuery(9, "sheet");
    expect(sheet(queryWithKey(queryKeys.campaign.warbandSheet(7, 9)))).toBe(true);
    expect(sheet(queryWithKey(queryKeys.campaign.warbandSheet(3, 9)))).toBe(true);
    expect(sheet(queryWithKey(queryKeys.campaign.warbandSheet(7, 10)))).toBe(false);
    expect(sheet(queryWithKey(queryKeys.campaign.warbandStash(7, 9)))).toBe(false);
    expect(sheet(queryWithKey(queryKeys.campaign.myWarband(7)))).toBe(false);
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

describe("splitWarbandPatch and mergeSheetWarband", () => {
  it("puts summary fields in the summary part and the rest in the warband part", () => {
    const patch = { name: "Wolves", faction: "Middenheim", gold: 40, rating: 120, resources: [] };

    expect(splitWarbandPatch(patch as Partial<Warband>)).toEqual({
      warband: { name: "Wolves", faction: "Middenheim" },
      summary: { gold: 40, rating: 120, resources: [] },
    });
  });

  it("merges a patch into the sheet's warband and summary", () => {
    const sheet = makeSheet();

    const merged = mergeSheetWarband(sheet, { name: "Grey Wolves", gold: 60 });

    expect(merged.warband).toMatchObject({ id: 9, name: "Grey Wolves" });
    expect(merged.summary).toEqual({ gold: 60, rating: 90 });
    expect(mergeSheetWarband(sheet, { backstory: "Once" }).summary).toBe(sheet.summary);
  });

  it("keeps a saved summary's roster counts in the summary, so the page shows them (decision 12)", () => {
    const sheet = { ...makeSheet(), summary: { gold: 100, hero_count: 1, unit_count: 4 } };

    const merged = mergeSheetWarband(sheet, { gold: 65, hero_count: 3, unit_count: 6 });

    expect(merged.summary).toEqual({ gold: 65, hero_count: 3, unit_count: 6 });
    expect(sheetWarband(merged)).toMatchObject({ hero_count: 3, unit_count: 6 });
  });
});

describe("applyWarbandUpdate", () => {
  const sheetKey = queryKeys.campaign.warbandSheet(7, 9);
  const seed = () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(sheetKey, makeSheet());
    queryClient.setQueryData(queryKeys.campaign.warbandStash(7, 9), [{ id: 50, quantity: 1 }]);
    return queryClient;
  };
  const sheetOf = (queryClient: ReturnType<typeof seed>) =>
    queryClient.getQueryData<WarbandSheet>(sheetKey) as WarbandSheet;

  it("merges unit and stash rows and a returned summary into the cached sheet", () => {
    const queryClient = seed();
    const before = sheetOf(queryClient);

    applyWarbandUpdate(queryClient, 9, {
      heroes: [{ id: 1, xp: 4 } as never],
      removedHeroIds: [2],
      stashItems: [{ id: 51, quantity: 2 } as never],
      removedStashItemIds: [50],
      summary: { gold: 80 },
    });

    const after = sheetOf(queryClient);
    expect(after.heroes).toEqual([{ id: 1, name: "Aldric", xp: 4 }]);
    expect(after.summary).toEqual({ gold: 80, rating: 90 });
    // Untouched parts keep their identity, so readers of them don't re-render.
    expect(after.henchmen_groups).toBe(before.henchmen_groups);
    expect(after.warband).toBe(before.warband);
    expect(queryClient.getQueryData(queryKeys.campaign.warbandStash(7, 9))).toEqual([
      { id: 51, quantity: 2 },
    ]);
    expect(api.getWarbandSummary).not.toHaveBeenCalled();
  });

  it("re-reads only the summary of a sheet on screen when no summary came back", async () => {
    const queryClient = seed();
    api.getWarbandSummary.mockResolvedValue({ gold: 70, rating: 95 });
    const fetchSheet = vi.fn(async () => makeSheet());

    // Nobody shows the sheet: it is only marked stale for the next visit.
    applyWarbandUpdate(queryClient, 9, { heroes: [{ id: 1, xp: 5 } as never] });
    await vi.waitFor(() => expect(queryClient.isFetching()).toBe(0));
    expect(api.getWarbandSummary).not.toHaveBeenCalled();
    expect(queryClient.getQueryState(sheetKey)?.isInvalidated).toBe(true);
    expect(sheetOf(queryClient).heroes[0]).toMatchObject({ xp: 5 });

    // The warband page shows it: its summary is re-read, not the whole sheet.
    queryClient.setQueryData(sheetKey, makeSheet());
    const page = new QueryObserver(queryClient, {
      queryKey: sheetKey,
      queryFn: fetchSheet,
      staleTime: Infinity,
    });
    const stopPage = page.subscribe(() => undefined);
    applyWarbandUpdate(queryClient, 9);
    await vi.waitFor(() => expect(sheetOf(queryClient).summary).toEqual({ gold: 70, rating: 95 }));
    expect(api.getWarbandSummary).toHaveBeenCalledTimes(1);
    expect(api.getWarbandSummary).toHaveBeenCalledWith(9);
    expect(fetchSheet).not.toHaveBeenCalled();
    stopPage();
  });

  it("keeps the cached summary when the re-read fails", async () => {
    const queryClient = seed();
    api.getWarbandSummary.mockRejectedValue(new Error("offline"));
    const page = new QueryObserver(queryClient, {
      queryKey: sheetKey,
      queryFn: async () => makeSheet(),
      staleTime: Infinity,
    });
    const stopPage = page.subscribe(() => undefined);

    applyWarbandUpdate(queryClient, 9);

    await vi.waitFor(() => expect(api.getWarbandSummary).toHaveBeenCalled());
    await vi.waitFor(() => expect(queryClient.isFetching()).toBe(0));
    expect(sheetOf(queryClient).summary).toEqual({ gold: 100, rating: 90 });
    stopPage();
  });
});
