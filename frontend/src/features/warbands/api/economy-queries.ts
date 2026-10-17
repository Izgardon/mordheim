import { queryOptions, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { applyWarbandUpdate, isWarbandQuery } from "./warband-cache";
import {
  createWarbandTrade,
  listWarbandItems,
  listWarbandLogs,
  listWarbandTrades,
} from "./warbands-api";

import type { WarbandTrade, WarbandTradePayload } from "../types/warband-types";

/*
 * A warband's economy as server state: its stash, its ledger (the Treasury tab) and its logs, each
 * cached under the warband (`["campaign", id, "warband", id, ...]`), and the writes that change
 * them. A write patches the cache from its answer; it re-reads only what the answer lacks.
 */

/**
 * The Treasury and Logs tabs read their list each time they are shown and drop it when they
 * close, with no focus, reconnect or retry read: what the tabs did before they used TanStack.
 * Logs on cursor pages (PR C) can turn this into a cached infinite query.
 */
const READ_ON_EVERY_VISIT = {
  staleTime: 0,
  gcTime: 0,
  retry: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;

/** The ledger, newest row first, group rows carrying their children. */
export const warbandTreasuryQuery = (campaignId: number, warbandId: number) =>
  queryOptions({
    queryKey: queryKeys.campaign.warbandTreasury(campaignId, warbandId),
    queryFn: (): Promise<WarbandTrade[]> => listWarbandTrades(warbandId),
    ...READ_ON_EVERY_VISIT,
  });

/** Every log entry of the warband, newest first (the tab pages and filters them). */
export const warbandLogsQuery = (campaignId: number, warbandId: number) =>
  queryOptions({
    queryKey: queryKeys.campaign.warbandLogs(campaignId, warbandId),
    queryFn: () => listWarbandLogs(warbandId),
    ...READ_ON_EVERY_VISIT,
  });

/**
 * The stash: read each time it opens (`enabled` follows it) and kept while closed, so item moves
 * and sales elsewhere on the page merge into it (`applyWarbandUpdate`).
 */
export const warbandStashQuery = (campaignId: number, warbandId: number) =>
  queryOptions({
    queryKey: queryKeys.campaign.warbandStash(campaignId, warbandId),
    queryFn: () => listWarbandItems(warbandId),
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

/** A new ledger row on top of each cached ledger of the warband (the server lists newest first). */
export function prependTreasuryRow(queryClient: QueryClient, warbandId: number, row: WarbandTrade) {
  queryClient.setQueriesData<WarbandTrade[]>(
    { predicate: isWarbandQuery(warbandId, "treasury") },
    (rows: WarbandTrade[] | undefined) => (rows ? [row, ...rows] : rows)
  );
}

/**
 * A manual Treasury entry. The answer is the row, so it goes on top of the ledger; it carries no
 * gold, so the summary is re-read (BUG-37). Once the answer carries the summary, merge it here.
 */
export function useLedgerEntry(warbandId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: WarbandTradePayload) => createWarbandTrade(warbandId, payload),
    onSuccess: (row) => {
      applyWarbandUpdate(queryClient, warbandId);
      prependTreasuryRow(queryClient, warbandId, row);
    },
  });
}
