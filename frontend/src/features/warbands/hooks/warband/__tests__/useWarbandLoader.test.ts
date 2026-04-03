import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useWarbandLoader } from "../useWarbandLoader";

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

const createDeferred = <T,>(): Deferred<T> => {
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
  getWarbandById: vi.fn(),
  getWarbandSummary: vi.fn(),
  listWarbandHeroes: vi.fn(),
  listWarbandHiredSwords: vi.fn(),
  listWarbandHenchmenGroups: vi.fn(),
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

describe("useWarbandLoader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps rich unit data when a thinner initial warband snapshot arrives after load", async () => {
    apiMocks.getWarbandById.mockResolvedValue(baseWarband);
    apiMocks.getWarbandSummary.mockResolvedValue(summaryWarbandState);
    apiMocks.listWarbandHeroes.mockResolvedValue([richHero]);
    apiMocks.listWarbandHiredSwords.mockResolvedValue([richHiredSword]);
    apiMocks.listWarbandHenchmenGroups.mockResolvedValue([richGroup]);

    const { result, rerender } = renderHook(
      ({ initialWarband }) =>
        useWarbandLoader({
          campaignId: 1,
          hasCampaignId: true,
          resolvedWarbandId: 9,
          initialWarband,
        }),
      {
        initialProps: {
          initialWarband: null as Warband | null,
        },
      }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.heroes[0]?.xp).toBe(12);
    expect(result.current.heroes[0]?.level_up).toBe(1);
    expect(result.current.hiredSwords[0]?.xp).toBe(8);
    expect(result.current.hiredSwords[0]?.level_up).toBe(2);
    expect(result.current.henchmenGroups[0]?.xp).toBe(5);
    expect(result.current.henchmenGroups[0]?.level_up).toBe(1);

    const thinInitialWarband = {
      ...baseWarband,
      gold: 77,
      rating: 222,
      resources: [
        {
          id: 4,
          warband_id: 9,
          name: "Wyrdstone",
          amount: 3,
        },
      ],
      heroes: [{ id: 1, name: "Captain", unit_type: "Mercenary" }],
      hired_swords: [{ id: 2, name: "Ogre", unit_type: "Hired Sword" }],
      henchmen_groups: [{ id: 3, name: "Marksmen", unit_type: "Henchmen" }],
    } as Warband;

    rerender({ initialWarband: thinInitialWarband });

    await waitFor(() => {
      expect(result.current.warband?.gold).toBe(77);
      expect(result.current.warband?.rating).toBe(222);
      expect(result.current.heroes[0]?.xp).toBe(12);
      expect(result.current.heroes[0]?.level_up).toBe(1);
      expect(result.current.hiredSwords[0]?.xp).toBe(8);
      expect(result.current.hiredSwords[0]?.level_up).toBe(2);
      expect(result.current.henchmenGroups[0]?.xp).toBe(5);
      expect(result.current.henchmenGroups[0]?.level_up).toBe(1);
    });
  });

  it("clears the previous warband state immediately when the route target changes", () => {
    const otherWarband = {
      ...baseWarband,
      heroes: [{ id: 1, name: "Captain", unit_type: "Mercenary" }],
      hired_swords: [{ id: 2, name: "Ogre", unit_type: "Hired Sword" }],
      henchmen_groups: [{ id: 3, name: "Marksmen", unit_type: "Henchmen" }],
    } as Warband;

    apiMocks.getWarbandById.mockReturnValue(new Promise(() => undefined));
    apiMocks.getWarband.mockReturnValue(new Promise(() => undefined));

    const { result, rerender } = renderHook(
      ({ resolvedWarbandId, initialWarband }) =>
        useWarbandLoader({
          campaignId: 1,
          hasCampaignId: true,
          resolvedWarbandId,
          initialWarband,
        }),
      {
        initialProps: {
          resolvedWarbandId: 9 as number | null,
          initialWarband: otherWarband as Warband | null,
        },
      }
    );

    expect(result.current.warband?.id).toBe(9);
    expect(result.current.heroes).toHaveLength(1);

    rerender({
      resolvedWarbandId: null,
      initialWarband: null,
    });

    expect(result.current.warband).toBeNull();
    expect(result.current.heroes).toEqual([]);
    expect(result.current.hiredSwords).toEqual([]);
    expect(result.current.henchmenGroups).toEqual([]);
    expect(result.current.isLoading).toBe(true);
  });

  it("ignores stale responses from the previous route target", async () => {
    const otherWarbandDeferred = createDeferred<Warband>();
    const currentWarband = {
      ...baseWarband,
      id: 12,
      name: "The Gallows Men",
      user_id: 7,
    };
    const currentHero = { ...richHero, warband_id: 12, name: "Brakk", id: 11 };
    const currentHiredSword = {
      ...richHiredSword,
      warband_id: 12,
      name: "Pit Ogre",
      id: 12,
    };
    const currentGroup = {
      ...richGroup,
      warband_id: 12,
      name: "Cutthroats",
      id: 13,
    } as HenchmenGroup;

    apiMocks.getWarbandById.mockReturnValue(otherWarbandDeferred.promise);
    apiMocks.getWarband.mockResolvedValue(currentWarband);
    apiMocks.getWarbandSummary.mockImplementation((warbandId: number) =>
      Promise.resolve(
        warbandId === 12
          ? {
              gold: 99,
              rating: 201,
              resources: [],
              heroes: [{ id: 11, name: "Brakk", unit_type: "Mercenary" }],
              hired_swords: [{ id: 12, name: "Pit Ogre", unit_type: "Hired Sword" }],
              henchmen_groups: [{ id: 13, name: "Cutthroats", unit_type: "Henchmen" }],
            }
          : summaryWarbandState
      )
    );
    apiMocks.listWarbandHeroes.mockImplementation((warbandId: number) =>
      Promise.resolve(warbandId === 12 ? [currentHero] : [richHero])
    );
    apiMocks.listWarbandHiredSwords.mockImplementation((warbandId: number) =>
      Promise.resolve(warbandId === 12 ? [currentHiredSword] : [richHiredSword])
    );
    apiMocks.listWarbandHenchmenGroups.mockImplementation((warbandId: number) =>
      Promise.resolve(warbandId === 12 ? [currentGroup] : [richGroup])
    );

    const { result, rerender } = renderHook(
      ({ resolvedWarbandId }) =>
        useWarbandLoader({
          campaignId: 1,
          hasCampaignId: true,
          resolvedWarbandId,
          initialWarband: null,
        }),
      {
        initialProps: {
          resolvedWarbandId: 9 as number | null,
        },
      }
    );

    rerender({
      resolvedWarbandId: null,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.warband?.id).toBe(12);
      expect(result.current.heroes[0]?.name).toBe("Brakk");
    });

    otherWarbandDeferred.resolve(baseWarband);

    await waitFor(() => {
      expect(result.current.warband?.id).toBe(12);
      expect(result.current.heroes[0]?.name).toBe("Brakk");
    });

    expect(apiMocks.getWarbandSummary).toHaveBeenCalledTimes(1);
    expect(apiMocks.getWarbandSummary).toHaveBeenCalledWith(12);
  });
});
