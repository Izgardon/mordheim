import { queryOptions, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { applyWarbandUpdate, isWarbandQuery, type WarbandUpdate } from "./warband-cache";
import { sheetWarband } from "./warband-queries";
import {
  createWarbandResource,
  createWarbandTrade,
  deleteWarbandResource,
  listWarbandItems,
  listWarbandLogs,
  listWarbandTrades,
  sellWarbandItem,
  sellWarbandResource,
  transferWarbandItem,
  updateWarbandResource,
} from "./warbands-api";

import type { WarbandSheet } from "../types/warband-sheet";
import type { UnitListKey } from "../types/units";
import type {
  WarbandItemMutationResponse,
  WarbandItemSalePayload,
  WarbandItemTransferPayload,
  WarbandResource,
  WarbandTrade,
  WarbandTradePayload,
  WarbandUnitDetail,
} from "../types/warband-types";

/*
 * A warband's economy as server state: its stash, its ledger (the Treasury tab) and its logs, each
 * cached under the warband (`["campaign", id, "warband", id, ...]`), and the writes that change
 * them, plus a trade between two players (`["campaign", id, "trade", requestId]`, in
 * trade-queries.ts). A write patches the cache from its answer; it re-reads only what the answer
 * lacks.
 */

export * from "./trade-queries";
export * from "./ledger-queries";

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

/**
 * The warband's resources as each cached sheet holds them (in its summary, which the page reads),
 * changed by `update`: what the resource writes below answer.
 */
export function patchSheetResources(
  queryClient: QueryClient,
  warbandId: number,
  update: (resources: WarbandResource[]) => WarbandResource[]
) {
  queryClient.setQueriesData<WarbandSheet>(
    { predicate: isWarbandQuery(warbandId, "sheet") },
    (sheet: WarbandSheet | undefined) =>
      sheet && {
        ...sheet,
        summary: { ...sheet.summary, resources: update(sheetWarband(sheet).resources ?? []) },
      }
  );
}

const replaceResource = (saved: WarbandResource) => (resources: WarbandResource[]) =>
  resources.map((entry) => (entry.id === saved.id ? saved : entry));

/** +/- on a resource: the change (`delta`), which the server adds to what it stores (BUG-68). */
export function useResourceChange(warbandId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ resourceId, delta }: { resourceId: number; delta: number }) =>
      updateWarbandResource(warbandId, resourceId, { delta }),
    onSuccess: (saved) => patchSheetResources(queryClient, warbandId, replaceResource(saved)),
  });
}

/** A sale in one request: the resource, the new gold and the "Sell" ledger row come back. */
export function useResourceSale(warbandId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      resourceId,
      ...sale
    }: {
      resourceId: number;
      quantity: number;
      price: number;
    }) => sellWarbandResource(warbandId, resourceId, sale),
    onSuccess: ({ resource, summary, trade }) => {
      patchSheetResources(queryClient, warbandId, replaceResource(resource));
      applyWarbandUpdate(queryClient, warbandId, { summary });
      prependTreasuryRow(queryClient, warbandId, trade);
    },
  });
}

/** A new named resource, at 0. */
export function useResourceCreate(warbandId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => createWarbandResource(warbandId, { name }),
    onSuccess: (created) =>
      patchSheetResources(queryClient, warbandId, (resources) => [...resources, created]),
  });
}

/** Deletes a resource (PR C asks first, ECON-UX-03). */
export function useResourceDelete(warbandId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (resourceId: number) => deleteWarbandResource(warbandId, resourceId),
    onSuccess: (_answer, resourceId) =>
      patchSheetResources(queryClient, warbandId, (resources) =>
        resources.filter((entry) => entry.id !== resourceId)
      ),
  });
}

/** An item sale or move's answer, with the kind of unit that received a moved item. */
export type ItemMutationResult = WarbandItemMutationResponse & { targetUnitType?: string };

/** Sells copies of an item from the stash or a unit; the answer carries what changed. */
export function useItemSale(warbandId: number) {
  return useMutation({
    mutationFn: (payload: WarbandItemSalePayload) => sellWarbandItem(warbandId, payload),
  });
}

/** Moves copies of an item between the stash and units; the answer carries both ends. */
export function useItemMove(warbandId: number) {
  return useMutation({
    mutationFn: (payload: WarbandItemTransferPayload) => transferWarbandItem(warbandId, payload),
  });
}

/** The sheet list of each item-transfer target type ("stash" has none). */
const LIST_KEY_BY_SECTION: Partial<Record<string, UnitListKey>> = {
  heroes: "heroes",
  henchmen: "henchmenGroups",
  hiredswords: "hiredSwords",
};

const isUnit = (entry: unknown): entry is WarbandUnitDetail =>
  !!entry && typeof entry === "object" && !("quantity" in entry);

/**
 * Where an item sale's or move's answer goes in the cache (ECON-CQ-06): the summary, the stash
 * row (or its removal), the receiving unit into its own kind's list (BUG-86), and, for a unit
 * source, the source unit (`units`, as the card holds it, then the answer's copy) into its list.
 */
export function itemMutationUpdate(
  result: ItemMutationResult,
  source?: { listKey: UnitListKey; units: WarbandUnitDetail[] }
): WarbandUpdate {
  const update: WarbandUpdate = {
    summary: result.summary,
    stashItems: result.stash_item ? [result.stash_item] : undefined,
    removedStashItemIds: result.removed_stash_item_id ? [result.removed_stash_item_id] : undefined,
  };
  const targetKey = LIST_KEY_BY_SECTION[result.targetUnitType ?? ""];
  const target = targetKey && isUnit(result.target) ? [result.target] : [];
  if (source) {
    const sameKind = targetKey === source.listKey ? target : [];
    Object.assign(update, {
      [source.listKey]: [...source.units, result.source, ...sameKind].filter(isUnit),
    });
  }
  if (targetKey && target.length && targetKey !== source?.listKey) {
    Object.assign(update, { [targetKey]: target });
  }
  return update;
}
