import { queryOptions, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import {
  getTradeRequest,
  lockTradeOffer,
  unlockTradeOffer,
  updateTradeOffer,
} from "@/features/campaigns/api/campaigns-api";
import { tradeFromError } from "../utils/trade-errors";
import { applyWarbandUpdate, isWarbandQuery } from "./warband-cache";
import { sheetWarband } from "./warband-queries";
import {
  createWarbandResource,
  createWarbandTrade,
  deleteWarbandResource,
  listWarbandItems,
  listWarbandLogs,
  listWarbandTrades,
  sellWarbandResource,
  updateWarbandResource,
} from "./warbands-api";

import type { TradeRequest } from "../types/trade-request-types";
import type { WarbandSheet } from "../types/warband-sheet";
import type { WarbandResource, WarbandTrade, WarbandTradePayload } from "../types/warband-types";

/*
 * A warband's economy as server state: its stash, its ledger (the Treasury tab) and its logs, each
 * cached under the warband (`["campaign", id, "warband", id, ...]`), and the writes that change
 * them, plus a trade between two players (`["campaign", id, "trade", requestId]`). A write
 * patches the cache from its answer; it re-reads only what the answer lacks.
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

/**
 * One trade request. Realtime events and write answers keep it current while a page shows it, so
 * it is never stale; a page reads it once when it mounts (events missed while away), and a failed
 * read is shown, not retried. Expiry (PR C) can set a refetch here.
 */
export const tradeQuery = (campaignId: number, requestId: string) =>
  queryOptions({
    queryKey: queryKeys.campaign.trade(campaignId, requestId),
    queryFn: () => getTradeRequest(campaignId, requestId),
    staleTime: Infinity,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });

/** The trade as the server last sent it (a write's answer or a realtime event's payload). */
export function setTradeData(queryClient: QueryClient, request: TradeRequest) {
  queryClient.setQueryData(queryKeys.campaign.trade(request.campaign_id, request.id), request);
}

/** The cached copy of a trade, if this browser holds one. */
export const readTradeData = (queryClient: QueryClient, campaignId: number, requestId: string) =>
  queryClient.getQueryData<TradeRequest>(queryKeys.campaign.trade(campaignId, requestId));

type TradeRef = { campaignId: number; requestId: string };
type TradeOfferPayload = Parameters<typeof updateTradeOffer>[2];

/** Saves your whole offer; the answer is the trade. */
export function useTradeOfferSave() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ campaignId, requestId, offer }: TradeRef & { offer: TradeOfferPayload }) =>
      updateTradeOffer(campaignId, requestId, offer),
    onSuccess: (request) => setTradeData(queryClient, request),
  });
}

/**
 * Accepts both offers at the version shown (BUG-35). A refusal that carries the trade (the offers
 * changed, or the completion failed and unlocked both sides) puts that trade in the cache too.
 */
export function useTradeLock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ campaignId, requestId, offerVersion }: TradeRef & { offerVersion?: number }) =>
      lockTradeOffer(campaignId, requestId, offerVersion),
    onSuccess: (request) => setTradeData(queryClient, request),
    onError: (error) => {
      const current = tradeFromError(error);
      if (current) {
        setTradeData(queryClient, current);
      }
    },
  });
}

/** Takes back your acceptance; the answer is the trade. */
export function useTradeUnlock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ campaignId, requestId }: TradeRef) => unlockTradeOffer(campaignId, requestId),
    onSuccess: (request) => setTradeData(queryClient, request),
  });
}
