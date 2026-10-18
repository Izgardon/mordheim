import { useCallback, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAuth } from "../../../auth/hooks/use-auth";
import {
  closeTradeRequest,
  createTradeRequest,
  getTradeRequest,
} from "../../../campaigns/api/campaigns-api";
import { setTradeData, tradeQuery } from "../../api/economy-queries";
import { queryKeys } from "@/lib/query-keys";
import { useWarbandCacheUpdate } from "../../api/warband-cache";
import { getErrorMessage } from "@/lib/get-error-message";
import { openTradeIdFromError } from "../../utils/trade-errors";
import { describeTradeEnd, isTradeOver, toTradeSession } from "../../utils/trade-status";
import { useTradeChannel } from "./useTradeChannel";

import type { TradeCompletion, TradeRequest, TradeSession } from "../../types/trade-request-types";

type UseWarbandTradeSessionParams = {
  campaignId: number;
  hasCampaignId: boolean;
  /** The sheet's `capabilities.trade`: only the warband's owner trades for it (decision 10). */
  enabled: boolean;
  warbandId: number | undefined;
  loadWarchestItems: () => void;
};

type UseWarbandTradeSessionReturn = {
  /** The open trade, from `?trade=` and the trade query; null when none is open. */
  session: TradeSession | null;
  tradeRequest: TradeRequest | null;
  /** A write's answer (offer, lock, unlock); a completing lock also ends the session. */
  handleRequestUpdated: (request: TradeRequest) => void;
  handleTradeRequestCreated: (targetUserId: number) => Promise<void>;
  handleTradeSessionClose: () => void;
};

/**
 * The trade open on the warband page. `?trade=<id>` says which trade it is; the trade query holds
 * it, read once per visit (BUG-113) and patched by write answers and realtime events, so no copy
 * of it lives in the app store.
 */
export function useWarbandTradeSession({
  campaignId,
  hasCampaignId,
  enabled,
  warbandId,
  loadWarchestItems,
}: UseWarbandTradeSessionParams): UseWarbandTradeSessionReturn {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const updateWarbandCache = useWarbandCacheUpdate();
  const [searchParams, setSearchParams] = useSearchParams();
  // Off another player's warband (BUG-43): no trade is read, shown or listened to there.
  const canLoad = enabled && hasCampaignId && !Number.isNaN(campaignId);
  const userId = user?.id;
  const tradeParam = searchParams.get("trade");
  // The latest URL, for callbacks that must not change with every ?tab= (ECON-PERF-02).
  const latest = useRef({ searchParams, setSearchParams });
  latest.current = { searchParams, setSearchParams };
  // The trade whose end this page has already handled (it says nothing more about it).
  const handledEnd = useRef<string | null>(null);

  const trade = useQuery({
    ...tradeQuery(campaignId, tradeParam ?? ""),
    enabled: canLoad && Boolean(user) && Boolean(tradeParam),
  });
  const request = canLoad && tradeParam && trade.data?.id === tradeParam ? trade.data : null;
  const session = useMemo(
    () =>
      request && userId !== undefined && !isTradeOver(request)
        ? toTradeSession(request, userId)
        : null,
    [request, userId]
  );

  const setTradeParam = useCallback((requestId: string | null) => {
    const next = new URLSearchParams(latest.current.searchParams);
    if (requestId) {
      next.set("trade", requestId);
    } else {
      next.delete("trade");
    }
    latest.current.setSearchParams(next, { replace: true });
  }, []);

  /** Says how a trade ended: cancelled by its sender, declined, expired or completed. */
  const announceEnd = useCallback(
    (ended: TradeRequest) => {
      const text = describeTradeEnd(ended, userId);
      if (text) {
        toast(text, { id: `trade-ended-${ended.id}` });
      }
    },
    [userId]
  );

  // A trade that has ended (a link to it, or the server saying so) leaves the URL, with why.
  useEffect(() => {
    if (request && isTradeOver(request)) {
      setTradeParam(null);
      if (handledEnd.current !== request.id) {
        announceEnd(request);
      }
    }
  }, [announceEnd, request, setTradeParam]);

  const failure = trade.isError ? trade.error : null;
  const hasCopy = trade.data !== undefined;
  useEffect(() => {
    if (failure) {
      toast.error(hasCopy ? "Couldn't load the trade." : "Couldn't open the trade.", {
        description: getErrorMessage(failure),
      });
    }
  }, [failure, hasCopy]);

  // The warchest is offered once the trade is open.
  const sessionStatus = session?.status;
  useEffect(() => {
    if (sessionStatus === "active") {
      loadWarchestItems();
    }
  }, [loadWarchestItems, sessionStatus]);

  const handleTradeRequestCreated = useCallback(
    async (targetUserId: number) => {
      if (!canLoad || !user) {
        return;
      }
      let created: TradeRequest;
      try {
        created = await createTradeRequest(campaignId, targetUserId);
      } catch (error) {
        // One open trade per pair of warbands (BUG-114): open the one that exists instead.
        const openId = openTradeIdFromError(error);
        if (!openId) {
          throw error;
        }
        created = await getTradeRequest(campaignId, openId);
        toast("You already have a trade open with this player.", { id: `trade-open-${openId}` });
      }
      // The answer is the request, so it isn't read again (BUG-113).
      setTradeData(queryClient, created);
      setTradeParam(created.id);
    },
    [campaignId, canLoad, queryClient, setTradeParam, user]
  );

  /**
   * A completed trade, from the completing lock's answer or the `trade.completed` event: each
   * warband takes the summary the completion carries (no summary GET), and the stash reloads.
   */
  const finishTrade = useCallback(
    (completed: TradeCompletion, endsSession: boolean) => {
      handledEnd.current = completed.id;
      if (endsSession) {
        setTradeParam(null);
      }
      setTradeData(queryClient, completed);
      if (completed.from_summary && completed.to_summary) {
        updateWarbandCache(completed.from_warband.id, { summary: completed.from_summary });
        updateWarbandCache(completed.to_warband.id, { summary: completed.to_summary });
      } else if (warbandId) {
        updateWarbandCache(warbandId);
      }
      if (warbandId) {
        loadWarchestItems();
      }
    },
    [loadWarchestItems, queryClient, setTradeParam, updateWarbandCache, warbandId]
  );

  const handleRequestUpdated = useCallback(
    (updated: TradeRequest) => {
      if (updated.status === "completed") {
        // The locker gets no event of its own once it names its socket: its answer completes.
        finishTrade(updated, true);
        return;
      }
      setTradeData(queryClient, updated);
    },
    [finishTrade, queryClient]
  );

  const handleTradeSessionClose = useCallback(() => {
    if (session && canLoad) {
      handledEnd.current = session.requestId;
      const partner = session.partner.label;
      // This browser no longer shows it: the `trade_closed` the close sends says nothing here.
      queryClient.removeQueries({
        queryKey: queryKeys.campaign.trade(campaignId, session.requestId),
        exact: true,
      });
      // The dialog closes at once; a failed close is said, not swallowed (ECON-UX-05).
      closeTradeRequest(campaignId, session.requestId)
        .then((closed) => setTradeData(queryClient, closed))
        .catch((error: unknown) => {
          toast.error(`Couldn't cancel the trade with ${partner}.`, {
            description: getErrorMessage(error, "It may stay open until it expires."),
          });
        })
        .finally(() => {
          if (warbandId) {
            updateWarbandCache(warbandId);
          }
        });
    }
    setTradeParam(null);
  }, [campaignId, canLoad, queryClient, session, setTradeParam, updateWarbandCache, warbandId]);

  useTradeChannel({
    session,
    onCompleted: finishTrade,
    onClosed: (closed) => {
      if (warbandId) {
        updateWarbandCache(warbandId);
      }
      setTradeParam(null);
      if (closed?.id) {
        handledEnd.current = closed.id;
        setTradeData(queryClient, closed);
        announceEnd(closed);
      }
    },
    // Time ran out: the trade reads as expired from now on, which closes it here with a toast.
    onExpired: () => {
      if (request && !isTradeOver(request)) {
        setTradeData(queryClient, { ...request, status: "expired" });
      }
    },
  });

  return {
    session,
    tradeRequest: session ? request : null,
    handleRequestUpdated,
    handleTradeRequestCreated,
    handleTradeSessionClose,
  };
}
