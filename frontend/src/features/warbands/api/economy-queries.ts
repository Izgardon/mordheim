import { queryOptions, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { applyWarbandUpdate, isWarbandQuery, type WarbandUpdate } from "./warband-cache";
import { sheetWarband } from "./warband-queries";
import { prependTreasuryRow } from "./ledger-queries";
import {
  createWarbandResource,
  deleteWarbandResource,
  listWarbandItems,
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
  hirelings: "hirelings",
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
