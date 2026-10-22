import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryObserver } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useUnitAdvance, useUnitPatch, useUnitXp } from "./useUnitMutations";
import { heroKind } from "@/features/warbands/units/kinds/hero";
import { henchmenKind } from "@/features/warbands/units/kinds/henchmen";
import { queryKeys } from "@/lib/query-keys";
import { createQueryWrapper, createTestQueryClient } from "@/test/query-test-utils";
import { makeVeteranHenchmenGroup, makeVeteranHero } from "@/test/warband-fixtures";

import type { WarbandSheet } from "@/features/warbands/types/warband-sheet";

const api = vi.hoisted(() => ({
  getWarbandSummary: vi.fn(),
  updateWarbandHero: vi.fn(),
  updateWarbandHenchmenGroup: vi.fn(),
  levelUpWarbandHenchmenGroup: vi.fn(),
}));
vi.mock("@/features/warbands/api/warbands-api", () => api);
vi.mock("@/features/warbands/units/unit-api", async () =>
  (await import("@/test/unit-api-mock")).unitApiModuleMock(api)
);

const sheetKey = queryKeys.campaign.warbandSheet(7, 9);
const hero = makeVeteranHero();
const group = makeVeteranHenchmenGroup();

/** A sheet on screen (observed, as the warband page observes it). */
const showSheet = () => {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData<WarbandSheet>(sheetKey, {
    warband: { id: 9 },
    summary: { gold: 100, rating: 60 },
    capabilities: {},
    heroes: [hero],
    henchmen_groups: [group],
    hirelings: [],
  } as unknown as WarbandSheet);
  const page = new QueryObserver(queryClient, {
    queryKey: sheetKey,
    queryFn: () => Promise.reject(new Error("no refetch expected")),
    staleTime: Infinity,
  });
  page.subscribe(() => undefined);
  const sheet = () => queryClient.getQueryData<WarbandSheet>(sheetKey) as WarbandSheet;
  return { queryClient, sheet, wrapper: createQueryWrapper(queryClient) };
};

beforeEach(() => {
  vi.clearAllMocks();
  api.getWarbandSummary.mockResolvedValue({ gold: 100, rating: 61 });
});

describe("unit mutations write the sheet from the response", () => {
  it("XP +/-: writes the unit and re-reads the summary, since the rating follows XP", async () => {
    const { sheet, wrapper } = showSheet();
    api.updateWarbandHero.mockResolvedValue({ ...hero, xp: 8 });
    const { result } = renderHook(() => useUnitXp(heroKind, 9), { wrapper });

    await act(() => result.current.mutateAsync({ unit: hero, xp: 8 }));

    expect(sheet().heroes[0].xp).toBe(8);
    await waitFor(() => expect(sheet().summary.rating).toBe(61));
    expect(api.getWarbandSummary).toHaveBeenCalledTimes(1);
  });

  it("a level-up: writes the group without re-reading the summary (PERF-27)", async () => {
    const { sheet, wrapper } = showSheet();
    api.levelUpWarbandHenchmenGroup.mockResolvedValue({ ...group, level_up: 0, leadership: 8 });
    const { result } = renderHook(() => useUnitAdvance(henchmenKind, 9), { wrapper });

    await act(() => result.current.mutateAsync({ unitId: group.id, payload: { group: "x" } }));

    expect(sheet().henchmen_groups[0]).toMatchObject({ level_up: 0, leadership: 8 });
    expect(api.getWarbandSummary).not.toHaveBeenCalled();
  });

  it("the trading action: writes the hero without re-reading the summary", async () => {
    const { sheet, wrapper } = showSheet();
    api.updateWarbandHero.mockResolvedValue({ ...hero, trading_action: false });
    const { result } = renderHook(() => useUnitPatch(heroKind, 9), { wrapper });

    await act(() =>
      result.current.mutateAsync({ unitId: hero.id, payload: { trading_action: false } })
    );

    expect(sheet().heroes[0].trading_action).toBe(false);
    expect(api.getWarbandSummary).not.toHaveBeenCalled();
  });
});
