import { queryOptions, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import {
  getTradeRequest,
  listCampaignTradeRequests,
  lockTradeOffer,
  unlockTradeOffer,
  updateTradeOffer,
} from "@/features/campaigns/api/campaigns-api";
import { toastTradeWarnings, tradeFromError } from "../utils/trade-errors";
import { isTradeOver } from "../utils/trade-status";
import { setHeroTradingAction } from "./warband-cache";

import type { TradeRequest } from "../types/trade-request-types";

/* A trade between two players, under the campaign: re-exported by economy-queries. */

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

const SIDES = ["from", "to"] as const;

/**
 * Keeps the traders' spent flags in the warbands' sheets as a trade moves (decision 9): the hero
 * a side's lock spent is spent; one given back (the id cleared on a trade that didn't complete)
 * is available again. A hero who was spent already is never named, so he stays spent.
 */
function syncTraderSpends(
  queryClient: QueryClient,
  before: TradeRequest | undefined,
  after: TradeRequest
) {
  for (const side of SIDES) {
    const warbandId = after[`${side}_warband`]?.id;
    if (warbandId === undefined) {
      continue;
    }
    const previous = before?.[`${side}_trader_spent_id`] ?? null;
    const current = after[`${side}_trader_spent_id`] ?? null;
    if (current !== null && current !== previous) {
      setHeroTradingAction(queryClient, warbandId, current, false);
    }
    if (previous !== null && current === null && after.status !== "completed") {
      setHeroTradingAction(queryClient, warbandId, previous, true);
    }
  }
}

const OPEN_STATUSES = ["accepted", "pending"] as const;

/**
 * Your open trades in the campaign: the campaign list (only your trades) read for each open
 * status. One open trade per pair of players keeps it short; the page reads it once per visit.
 */
export const openTradesQuery = (campaignId: number) =>
  queryOptions({
    queryKey: queryKeys.campaign.openTrades(campaignId),
    queryFn: async () =>
      (
        await Promise.all(
          OPEN_STATUSES.map((status) => listCampaignTradeRequests(campaignId, status))
        )
      ).flat(),
  });

/** A trade's newest copy in the cached open-trade list: it joins, moves or (once over) leaves. */
function patchOpenTrades(queryClient: QueryClient, request: TradeRequest) {
  queryClient.setQueryData<TradeRequest[]>(
    queryKeys.campaign.openTrades(request.campaign_id),
    (trades: TradeRequest[] | undefined) => {
      if (!trades) {
        return trades;
      }
      const others = trades.filter((trade) => trade.id !== request.id);
      return isTradeOver(request) ? others : [request, ...others];
    }
  );
}

/** The trade as the server last sent it (a write's answer or a realtime event's payload). */
export function setTradeData(queryClient: QueryClient, request: TradeRequest) {
  const key = queryKeys.campaign.trade(request.campaign_id, request.id);
  const before = queryClient.getQueryData<TradeRequest>(key);
  queryClient.setQueryData(key, request);
  syncTraderSpends(queryClient, before, request);
  patchOpenTrades(queryClient, request);
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
    onSuccess: (request) => {
      setTradeData(queryClient, request);
      toastTradeWarnings(request);
    },
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
    onSuccess: (request) => {
      setTradeData(queryClient, request);
      toastTradeWarnings(request);
    },
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
