import { useCallback } from "react";
import { useQueryClient, type Query, type QueryClient } from "@tanstack/react-query";

import type { UnitKindKey } from "../types/units";
import type {
  HenchmenGroup,
  WarbandHero,
  WarbandHiredSword,
  WarbandItemSummary,
  WarbandUnitsSummary,
} from "../types/warband-types";

/** What a write changed: rows to merge in, rows that went, and the fresh summary if known. */
export type WarbandUpdate = {
  summary?: WarbandUnitsSummary;
  heroes?: WarbandHero[];
  hiredSwords?: WarbandHiredSword[];
  henchmenGroups?: HenchmenGroup[];
  stashItems?: WarbandItemSummary[];
  removedHeroIds?: number[];
  removedHiredSwordIds?: number[];
  removedHenchmenGroupIds?: number[];
  removedStashItemIds?: number[];
};

/** Drops the removed rows, then merges each incoming row over its cached copy (or appends it). */
export function mergeById<T extends { id: number }>(
  current: T[],
  incoming?: T[],
  removedIds?: number[]
) {
  if (!incoming && !removedIds?.length) {
    return current;
  }
  const removed = new Set(removedIds ?? []);
  const next = current.filter((entry) => !removed.has(entry.id));
  const byId = new Map(next.map((entry) => [entry.id, entry]));
  for (const entry of incoming ?? []) {
    byId.set(entry.id, { ...(byId.get(entry.id) ?? {}), ...entry });
  }
  return Array.from(byId.values());
}

/**
 * Matches one warband's cached queries in whichever campaign holds them (writers know only the
 * warband id): `["campaign", *, "warband", warbandId, ...path]`.
 */
export const isWarbandQuery =
  (warbandId: number, ...path: string[]) =>
  (query: Query) => {
    const key = query.queryKey;
    return (
      key[0] === "campaign" &&
      key[2] === "warband" &&
      key[3] === warbandId &&
      path.every((segment, index) => key[4 + index] === segment)
    );
  };

const UNIT_LIST_UPDATES = [
  ["hero", "heroes", "removedHeroIds"],
  ["henchmen_group", "henchmenGroups", "removedHenchmenGroupIds"],
  ["hired_sword", "hiredSwords", "removedHiredSwordIds"],
] as const satisfies readonly (readonly [UnitKindKey, keyof WarbandUpdate, keyof WarbandUpdate])[];

function mergeList<T extends { id: number }>(
  queryClient: QueryClient,
  predicate: (query: Query) => boolean,
  incoming?: T[],
  removedIds?: number[]
) {
  if (!incoming && !removedIds?.length) {
    return;
  }
  queryClient.setQueriesData<T[]>({ predicate }, (current: T[] | undefined) =>
    current ? mergeById(current, incoming, removedIds) : current
  );
}

/**
 * Applies a write's result to the cached warband: unit lists and stash rows merge by id, and the
 * summary is merged when the write returned one, otherwise refetched by whoever shows it.
 */
export function applyWarbandUpdate(
  queryClient: QueryClient,
  warbandId: number,
  update: WarbandUpdate = {}
) {
  for (const [kind, listKey, removedKey] of UNIT_LIST_UPDATES) {
    mergeList(
      queryClient,
      isWarbandQuery(warbandId, "units", kind),
      update[listKey] as { id: number }[] | undefined,
      update[removedKey]
    );
  }
  mergeList(
    queryClient,
    isWarbandQuery(warbandId, "stash"),
    update.stashItems,
    update.removedStashItemIds
  );

  const summaryQuery = isWarbandQuery(warbandId, "summary");
  if (update.summary) {
    const summary = update.summary;
    queryClient.setQueriesData<WarbandUnitsSummary>(
      { predicate: summaryQuery },
      (current: WarbandUnitsSummary | undefined) => (current ? { ...current, ...summary } : current)
    );
  } else {
    // Only an on-screen warband page refetches; a failed refresh keeps the cached summary.
    void queryClient.invalidateQueries({ predicate: summaryQuery });
  }
}

/** `updateWarbandCache(warbandId, update?)` for components and hooks. */
export function useWarbandCacheUpdate() {
  const queryClient = useQueryClient();
  return useCallback(
    (warbandId: number, update?: WarbandUpdate) =>
      applyWarbandUpdate(queryClient, warbandId, update),
    [queryClient]
  );
}
