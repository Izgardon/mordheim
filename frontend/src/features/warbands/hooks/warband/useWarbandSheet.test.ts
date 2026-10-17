import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useWarbandSheet } from "./useWarbandSheet";
import { applyWarbandUpdate } from "@/features/warbands/api/warband-cache";
import { queryKeys } from "@/lib/query-keys";
import { createQueryWrapper, createTestQueryClient } from "@/test/query-test-utils";

import type { WarbandSheet } from "@/features/warbands/types/warband-sheet";
import type {
  HenchmenGroup,
  Warband,
  WarbandHero,
  WarbandHiredSword,
} from "@/features/warbands/types/warband-types";

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

const createDeferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const apiMocks = vi.hoisted(() => ({
  getWarband: vi.fn(),
  getWarbandSheet: vi.fn(),
  getWarbandSummary: vi.fn(),
}));

vi.mock("@/features/warbands/api/warbands-api", () => apiMocks);

const baseWarband: Warband = {
  id: 9,
  name: "The Black Crows",
  faction: "Mercenaries",
  campaign_id: 1,
  user_id: 4,
  created_at: "2026-04-03T10:00:00Z",
  updated_at: "2026-04-03T10:00:00Z",
};

const summaryWarbandState = {
  gold: 55,
  rating: 140,
  resources: [],
  heroes: [{ id: 1, name: "Captain", unit_type: "Mercenary" }],
  hired_swords: [{ id: 2, name: "Ogre", unit_type: "Hired Sword" }],
  henchmen_groups: [{ id: 3, name: "Marksmen", unit_type: "Henchmen" }],
};

const richHero = {
  id: 1,
  warband_id: 9,
  name: "Captain",
  unit_type: "Mercenary",
  race_id: null,
  price: 50,
  xp: 12,
  level_up: 1,
  armour_save: null,
  large: false,
  caster: "No",
  half_rate: false,
  dead: false,
  movement: 4,
  weapon_skill: 4,
  ballistic_skill: 4,
  strength: 3,
  toughness: 3,
  wounds: 1,
  initiative: 3,
  attacks: 1,
  leadership: 7,
  created_at: "2026-04-03T10:00:00Z",
  updated_at: "2026-04-03T10:00:00Z",
  items: [],
  skills: [],
  specials: [],
  spells: [],
} as WarbandHero;

const richHiredSword = {
  id: 2,
  warband_id: 9,
  name: "Ogre",
  unit_type: "Hired Sword",
  race_id: null,
  price: 80,
  hire_cost_expression: null,
  upkeep_price: 15,
  upkeep_cost_expression: null,
  rating: 20,
  xp: 8,
  level_up: 2,
  armour_save: null,
  large: true,
  caster: "No",
  available_skills: null,
  half_rate: false,
  blood_pacted: false,
  dead: false,
  movement: 6,
  weapon_skill: 3,
  ballistic_skill: 2,
  strength: 4,
  toughness: 4,
  wounds: 3,
  initiative: 2,
  attacks: 3,
  leadership: 7,
  created_at: "2026-04-03T10:00:00Z",
  updated_at: "2026-04-03T10:00:00Z",
  items: [],
  skills: [],
  specials: [],
  spells: [],
} as WarbandHiredSword;

const richGroup = {
  id: 3,
  warband_id: 9,
  name: "Marksmen",
  unit_type: "Henchmen",
  race_id: null,
  price: 25,
  xp: 5,
  max_size: 5,
  level_up: 1,
  large: false,
  half_rate: false,
  dead: false,
  movement: 4,
  weapon_skill: 3,
  ballistic_skill: 3,
  strength: 3,
  toughness: 3,
  wounds: 1,
  initiative: 3,
  attacks: 1,
  leadership: 6,
  items: [],
  skills: [],
  specials: [],
  henchmen: [{ id: 31, name: "Marksman", kills: 0, dead: false }],
  created_at: "2026-04-03T10:00:00Z",
  updated_at: "2026-04-03T10:00:00Z",
} as unknown as HenchmenGroup;

const capabilities = {
  edit: true,
  level_up: true,
  manage_items: true,
  edit_backstory: true,
  delete: true,
  add_custom: false,
};

const sheetOf = (overrides: Partial<WarbandSheet> = {}): WarbandSheet => ({
  warband: baseWarband,
  summary: summaryWarbandState as unknown as WarbandSheet["summary"],
  capabilities,
  heroes: [richHero],
  henchmen_groups: [richGroup],
  hired_swords: [richHiredSword],
  ...overrides,
});

const renderSheet = (queryClient = createTestQueryClient(), warbandId: number | null = 9) =>
  renderHook(() => useWarbandSheet({ campaignId: 1, hasCampaignId: true, warbandId }), {
    wrapper: createQueryWrapper(queryClient),
  });

describe("useWarbandSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads someone else's warband from one sheet request", async () => {
    apiMocks.getWarbandSheet.mockResolvedValue(sheetOf());

    const { result } = renderSheet();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.warband).toMatchObject({ id: 9, gold: 55, rating: 140 });
    expect(result.current.capabilities).toEqual(capabilities);
  });

  it("reads missing or unknown capabilities as not allowed", async () => {
    apiMocks.getWarbandSheet.mockResolvedValue(
      sheetOf({ capabilities: { edit: "yes", level_up: true } as never })
    );

    const { result } = renderSheet();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.capabilities).toEqual({
      edit: false,
      level_up: true,
      manage_items: false,
      edit_backstory: false,
      delete: false,
      add_custom: false,
    });
    expect(result.current.heroes).toEqual([richHero]);
    expect(result.current.hiredSwords).toEqual([richHiredSword]);
    expect(result.current.henchmenGroups).toEqual([richGroup]);
    expect(apiMocks.getWarbandSheet).toHaveBeenCalledTimes(1);
    expect(apiMocks.getWarbandSheet).toHaveBeenCalledWith(9);
    expect(apiMocks.getWarband).not.toHaveBeenCalled();
    expect(apiMocks.getWarbandSummary).not.toHaveBeenCalled();
  });

  it("resolves your warband from the campaign list, then reads its sheet", async () => {
    apiMocks.getWarband.mockResolvedValue(baseWarband);
    apiMocks.getWarbandSheet.mockResolvedValue(sheetOf());

    const { result } = renderSheet(createTestQueryClient(), null);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.warband?.name).toBe("The Black Crows");
    expect(apiMocks.getWarband).toHaveBeenCalledWith(1);
    expect(apiMocks.getWarbandSheet).toHaveBeenCalledTimes(1);
    expect(apiMocks.getWarbandSheet).toHaveBeenCalledWith(9);
  });

  it("shows no warband, and no loading state, when you have none in the campaign", async () => {
    apiMocks.getWarband.mockResolvedValue(null);

    const { result } = renderSheet(createTestQueryClient(), null);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.warband).toBeNull();
    expect(result.current.error).toBe("");
    expect(apiMocks.getWarbandSheet).not.toHaveBeenCalled();
  });

  it("keeps the units when a summary refresh lands", async () => {
    apiMocks.getWarbandSheet.mockResolvedValue(sheetOf());
    const queryClient = createTestQueryClient();
    const { result } = renderSheet(queryClient);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      applyWarbandUpdate(queryClient, 9, {
        summary: {
          gold: 77,
          rating: 222,
          heroes: [{ id: 1, name: "Captain", unit_type: "Mercenary" } as WarbandHero],
        },
      });
    });

    await waitFor(() => expect(result.current.warband?.gold).toBe(77));
    expect(result.current.warband?.rating).toBe(222);
    expect(result.current.heroes[0]?.xp).toBe(12);
    expect(result.current.heroes[0]?.level_up).toBe(1);
    expect(result.current.hiredSwords[0]?.level_up).toBe(2);
    expect(result.current.henchmenGroups[0]?.level_up).toBe(1);
  });

  it("clears the previous warband state immediately when the route target changes", () => {
    apiMocks.getWarband.mockReturnValue(new Promise(() => undefined));
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.campaign.warbandSheet(1, 9), sheetOf());
    const { result, rerender } = renderHook(
      ({ resolvedWarbandId }) =>
        useWarbandSheet({ campaignId: 1, hasCampaignId: true, warbandId: resolvedWarbandId }),
      {
        initialProps: { resolvedWarbandId: 9 as number | null },
        wrapper: createQueryWrapper(queryClient),
      }
    );

    expect(result.current.warband?.id).toBe(9);
    expect(result.current.heroes).toHaveLength(1);

    rerender({ resolvedWarbandId: null });

    expect(result.current.warband).toBeNull();
    expect(Object.values(result.current.capabilities)).not.toContain(true);
    expect(result.current.heroes).toEqual([]);
    expect(result.current.hiredSwords).toEqual([]);
    expect(result.current.henchmenGroups).toEqual([]);
    expect(result.current.isLoading).toBe(true);
  });

  it("ignores stale responses from the previous route target", async () => {
    const otherSheet = createDeferred<WarbandSheet>();
    const currentWarband = { ...baseWarband, id: 12, name: "The Gallows Men", user_id: 7 };
    const currentHero = { ...richHero, warband_id: 12, name: "Brakk", id: 11 };
    apiMocks.getWarband.mockResolvedValue(currentWarband);
    apiMocks.getWarbandSheet.mockImplementation((warbandId: number) =>
      warbandId === 12
        ? Promise.resolve(sheetOf({ warband: currentWarband, heroes: [currentHero] }))
        : otherSheet.promise
    );

    const { result, rerender } = renderHook(
      ({ resolvedWarbandId }) =>
        useWarbandSheet({ campaignId: 1, hasCampaignId: true, warbandId: resolvedWarbandId }),
      {
        initialProps: { resolvedWarbandId: 9 as number | null },
        wrapper: createQueryWrapper(createTestQueryClient()),
      }
    );

    rerender({ resolvedWarbandId: null });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.warband?.id).toBe(12);
      expect(result.current.heroes[0]?.name).toBe("Brakk");
    });

    await act(async () => otherSheet.resolve(sheetOf()));

    expect(result.current.warband?.id).toBe(12);
    expect(result.current.heroes[0]?.name).toBe("Brakk");
  });

  it("shows a cached sheet at once on a revisit and revalidates it in the background", async () => {
    apiMocks.getWarbandSheet.mockResolvedValue(sheetOf());
    const queryClient = createTestQueryClient();
    const first = renderSheet(queryClient);
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));
    first.unmount();

    const refetch = createDeferred<WarbandSheet>();
    apiMocks.getWarbandSheet.mockReturnValueOnce(refetch.promise);
    const second = renderSheet(queryClient);

    expect(second.result.current.isLoading).toBe(false);
    expect(second.result.current.warband?.gold).toBe(55);
    expect(second.result.current.heroes).toEqual([richHero]);
    await act(async () =>
      refetch.resolve(sheetOf({ summary: { ...summaryWarbandState, gold: 60 } as never }))
    );
    await waitFor(() => expect(second.result.current.warband?.gold).toBe(60));
    expect(apiMocks.getWarbandSheet).toHaveBeenCalledTimes(2);
  });

  it("keeps the shown warband when a later refetch fails", async () => {
    apiMocks.getWarbandSheet.mockResolvedValue(sheetOf());
    const queryClient = createTestQueryClient();
    const { result } = renderSheet(queryClient);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    apiMocks.getWarbandSheet.mockRejectedValueOnce(new Error("Server down"));
    await act(() =>
      queryClient.invalidateQueries({ queryKey: queryKeys.campaign.warbandSheet(1, 9) })
    );

    expect(apiMocks.getWarbandSheet).toHaveBeenCalledTimes(2);
    expect(result.current.error).toBe("");
    expect(result.current.isLoading).toBe(false);
    expect(result.current.warband?.gold).toBe(55);
  });

  it("reports a failed first load", async () => {
    apiMocks.getWarband.mockRejectedValue(new Error("Server down"));
    const { result } = renderSheet(createTestQueryClient(), null);

    await waitFor(() => expect(result.current.error).toBe("Server down"));
    expect(result.current.isLoading).toBe(false);
  });

  it("reports a failed sheet load", async () => {
    apiMocks.getWarbandSheet.mockRejectedValue(new Error("Forbidden"));
    const { result } = renderSheet();

    await waitFor(() => expect(result.current.error).toBe("Forbidden"));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.warband).toBeNull();
  });

  it("writes unit lists and warband patches into the cached sheet", async () => {
    apiMocks.getWarbandSheet.mockResolvedValue(sheetOf());
    const queryClient = createTestQueryClient();
    const { result } = renderSheet(queryClient);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setUnits.hero((heroes) => heroes.map((h) => ({ ...h, xp: 13 })));
      result.current.mergeWarband({ name: "The White Crows", gold: 40 });
    });

    await waitFor(() => expect(result.current.heroes[0]?.xp).toBe(13));
    expect(result.current.warband).toMatchObject({ name: "The White Crows", gold: 40 });
    const cached = queryClient.getQueryData<WarbandSheet>(queryKeys.campaign.warbandSheet(1, 9));
    expect(cached?.warband.name).toBe("The White Crows");
    expect(cached?.summary.gold).toBe(40);
  });
});
