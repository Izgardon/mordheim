import { useCallback } from "react";
import { useQueryClient, type Query, type QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { getWarbandSummary } from "./warbands-api";

import type { UnitCollectionKey } from "../types/units";
import type { WarbandSheet } from "../types/warband-sheet";
import type {
  HenchmenGroup,
  WarbandHero,
  WarbandHireling,
  WarbandItemSummary,
  WarbandUnitsSummary,
} from "../types/warband-types";

/**
 * What a write changed: rows to merge in, rows that went, and the fresh summary if known.
 * Without a summary the cached one is re-read, unless the write can't have changed gold or
 * rating (`summaryUnchanged`: a level-up, a trading action, a learned skill).
 */
export type WarbandUpdate = {
  summary?: WarbandUnitsSummary;
  summaryUnchanged?: boolean;
  heroes?: WarbandHero[];
  hirelings?: WarbandHireling[];
  henchmenGroups?: HenchmenGroup[];
  stashItems?: WarbandItemSummary[];
  removedHeroIds?: number[];
  removedHirelingIds?: number[];
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
  ["heroes", "heroes", "removedHeroIds"],
  ["henchmen_groups", "henchmenGroups", "removedHenchmenGroupIds"],
  ["hirelings", "hirelings", "removedHirelingIds"],
] as const satisfies readonly (readonly [
  UnitCollectionKey,
  keyof WarbandUpdate,
  keyof WarbandUpdate,
])[];

/** The sheet with the update's rows and summary merged in (untouched parts keep their identity). */
export function mergeSheetUpdate(sheet: WarbandSheet, update: WarbandUpdate): WarbandSheet {
  const next = { ...sheet };
  for (const [collection, listKey, removedKey] of UNIT_LIST_UPDATES) {
    Object.assign(next, {
      [collection]: mergeById<{ id: number }>(
        sheet[collection],
        update[listKey] as { id: number }[] | undefined,
        update[removedKey] as number[] | undefined
      ),
    });
  }
  if (update.summary) {
    next.summary = { ...sheet.summary, ...update.summary };
  }
  return next;
}

/**
 * Re-reads the summary (gold, rating, resources, the unit summaries) of each cached sheet of the
 * warband that is on screen, and marks the others stale. A failed read keeps the cached summary.
 * A read still on its way began before this write, so it is dropped for a new one: reusing it
 * would leave the header's rating as it was before the write.
 */
export function refreshSheetSummary(queryClient: QueryClient, warbandId: number) {
  const sheets = queryClient
    .getQueryCache()
    .findAll({ predicate: isWarbandQuery(warbandId, "sheet") });
  for (const query of sheets) {
    if (!query.isActive()) {
      void queryClient.invalidateQueries({ queryKey: query.queryKey, refetchType: "none" });
      continue;
    }
    const campaignId = query.queryKey[1] as number;
    const summaryKey = queryKeys.campaign.warbandSummary(campaignId, warbandId);
    void queryClient.cancelQueries({ queryKey: summaryKey });
    queryClient
      .fetchQuery({
        queryKey: summaryKey,
        queryFn: () => getWarbandSummary(warbandId),
        staleTime: 0,
        gcTime: 0,
      })
      .then((summary) =>
        queryClient.setQueryData<WarbandSheet>(
          query.queryKey,
          (sheet: WarbandSheet | undefined) =>
            sheet && { ...sheet, summary: { ...sheet.summary, ...summary } }
        )
      )
      .catch(() => undefined);
  }
}

/** A cached sheet of the warband, from whichever campaign holds it (undefined if none). */
export function readCachedSheet(queryClient: QueryClient, warbandId: number) {
  return queryClient
    .getQueriesData<WarbandSheet>({ predicate: isWarbandQuery(warbandId, "sheet") })
    .map(([, sheet]) => sheet)
    .find((sheet) => sheet !== undefined);
}

/**
 * The ledger and the log after a write the server recorded rows for (purchases, sales, moves,
 * recruits, level-ups...): marked stale, so a tab shown later reads them again. Nothing is read
 * now; a tab on screen keeps what it shows (ECON-PERF-08).
 */
export function markLedgerStale(queryClient: QueryClient, warbandId: number) {
  for (const path of ["treasury", "logs"]) {
    void queryClient.invalidateQueries({
      predicate: isWarbandQuery(warbandId, path),
      refetchType: "none",
    });
  }
}

/**
 * Applies a write's result to the cached warband sheet: unit and stash rows merge by id, and the
 * summary is merged when the write returned one, otherwise re-read (see `WarbandUpdate`). The
 * ledger and the log are marked stale (`markLedgerStale`).
 */
export function applyWarbandUpdate(
  queryClient: QueryClient,
  warbandId: number,
  update: WarbandUpdate = {}
) {
  queryClient.setQueriesData<WarbandSheet>(
    { predicate: isWarbandQuery(warbandId, "sheet") },
    (sheet: WarbandSheet | undefined) => (sheet ? mergeSheetUpdate(sheet, update) : sheet)
  );
  if (update.stashItems || update.removedStashItemIds?.length) {
    queryClient.setQueriesData<WarbandItemSummary[]>(
      { predicate: isWarbandQuery(warbandId, "stash") },
      (current: WarbandItemSummary[] | undefined) =>
        current ? mergeById(current, update.stashItems, update.removedStashItemIds) : current
    );
  }
  if (!update.summary && !update.summaryUnchanged) {
    refreshSheetSummary(queryClient, warbandId);
  }
  markLedgerStale(queryClient, warbandId);
}

/**
 * A hero's trading action as each cached sheet of his warband shows it (detail and summary rows):
 * `available` false once a trade or search spent it. Rows not in the cache are left alone.
 */
export function setHeroTradingAction(
  queryClient: QueryClient,
  warbandId: number,
  heroId: number,
  available: boolean
) {
  const mark = <H extends { id: number; trading_action?: boolean | null }>(heroes?: H[]) =>
    heroes?.map((hero) => (hero.id === heroId ? { ...hero, trading_action: available } : hero));
  queryClient.setQueriesData<WarbandSheet>(
    { predicate: isWarbandQuery(warbandId, "sheet") },
    (sheet: WarbandSheet | undefined) =>
      sheet && {
        ...sheet,
        heroes: mark(sheet.heroes) ?? sheet.heroes,
        summary: sheet.summary.heroes
          ? { ...sheet.summary, heroes: mark(sheet.summary.heroes) }
          : sheet.summary,
      }
  );
}

/** Marks the warband's cached reads under each path stale; the ones on screen are read again. */
export function invalidateWarbandReads(
  queryClient: QueryClient,
  warbandId: number,
  ...paths: string[]
) {
  for (const path of paths) {
    void queryClient.invalidateQueries({ predicate: isWarbandQuery(warbandId, path) });
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
