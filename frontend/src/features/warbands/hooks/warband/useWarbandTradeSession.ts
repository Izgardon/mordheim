import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useSearchParams } from "react-router-dom";

import { useAppStore } from "@/stores/app-store";
import { useAuth } from "../../../auth/hooks/use-auth";
import {
  closeTradeRequest,
  createTradeRequest,
  getTradeRequest,
} from "../../../campaigns/api/campaigns-api";
import { useWarbandCacheUpdate } from "../../api/warband-cache";
import { useTradeEvents } from "@/lib/realtime";

import type { TradeRequest, TradeSession } from "../../types/trade-request-types";

type UseWarbandTradeSessionParams = {
  campaignId: number;
  hasCampaignId: boolean;
  warbandId: number | undefined;
  loadWarchestItems: () => void;
};

type UseWarbandTradeSessionReturn = {
  tradeRequest: TradeRequest | null;
  setTradeRequest: Dispatch<SetStateAction<TradeRequest | null>>;
  handleTradeRequestCreated: (targetUserId: number) => Promise<void>;
  handleTradeSessionClose: () => void;
};

/** A request that can no longer be traded on. */
const isOver = (request: TradeRequest) =>
  request.status === "declined" || request.status === "expired" || request.status === "completed";

export function useWarbandTradeSession({
  campaignId,
  hasCampaignId,
  warbandId,
  loadWarchestItems,
}: UseWarbandTradeSessionParams): UseWarbandTradeSessionReturn {
  const { user } = useAuth();
  const { tradeSession, setTradeSession } = useAppStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tradeRequest, setTradeRequest] = useState<TradeRequest | null>(null);
  const updateWarbandCache = useWarbandCacheUpdate();
  const [expiredRequestId, setExpiredRequestId] = useState<string | null>(null);
  const canLoad = hasCampaignId && !Number.isNaN(campaignId);

  const tradeRequestParam = searchParams.get("trade");
  // The latest URL and request, read by effects keyed on the trade alone (ECON-PERF-02).
  const latest = useRef({ searchParams, setSearchParams, tradeRequest });
  latest.current = { searchParams, setSearchParams, tradeRequest };

  /** Drops `?trade=` from the URL, keeping the other parameters. */
  const dropTradeParam = useCallback(() => {
    const next = new URLSearchParams(latest.current.searchParams);
    next.delete("trade");
    latest.current.setSearchParams(next, { replace: true });
  }, []);

  const buildTradeSession = useCallback(
    (request: TradeRequest, status: TradeSession["status"]): TradeSession => {
      const role = request.from_user.id === user?.id ? "initiator" : "recipient";
      return {
        requestId: request.id,
        campaignId: request.campaign_id,
        partner: role === "initiator" ? request.to_user : request.from_user,
        fromWarband: request.from_warband,
        toWarband: request.to_warband,
        status,
        expiresAt: request.expires_at,
        role,
      };
    },
    [user?.id]
  );

  const handleTradeRequestCreated = useCallback(
    async (targetUserId: number) => {
      if (!canLoad || !user) {
        return;
      }
      const request = await createTradeRequest(campaignId, targetUserId);
      // The answer is the request, so it isn't read again (BUG-113).
      setTradeRequest(request);
      setTradeSession(buildTradeSession(request, "pending"));
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set("trade", request.id);
      setSearchParams(nextParams, { replace: true });
    },
    [buildTradeSession, campaignId, canLoad, searchParams, setSearchParams, setTradeSession, user]
  );

  const handleTradeSessionClose = useCallback(() => {
    if (tradeSession && canLoad) {
      closeTradeRequest(campaignId, tradeSession.requestId)
        .catch(() => {})
        .finally(() => {
          if (warbandId) {
            updateWarbandCache(warbandId);
          }
        });
    }
    setTradeSession(null);
    dropTradeParam();
  }, [
    campaignId,
    canLoad,
    dropTradeParam,
    setTradeSession,
    tradeSession,
    updateWarbandCache,
    warbandId,
  ]);

  // Restore the session from ?trade= (a link or a notification): one read of the request,
  // which the session keeps, so the read below doesn't repeat it (BUG-113).
  const sessionRequestId = tradeSession?.requestId ?? null;
  useEffect(() => {
    if (!tradeRequestParam || !canLoad || !user || sessionRequestId === tradeRequestParam) {
      return;
    }
    getTradeRequest(campaignId, tradeRequestParam)
      .then((request) => {
        if (isOver(request)) {
          setTradeSession(null);
          dropTradeParam();
          return;
        }
        setTradeRequest(request);
        setTradeSession(
          buildTradeSession(request, request.status === "accepted" ? "active" : "pending")
        );
      })
      .catch(() => undefined);
  }, [
    buildTradeSession,
    campaignId,
    canLoad,
    dropTradeParam,
    sessionRequestId,
    setTradeSession,
    tradeRequestParam,
    user,
  ]);

  // Load warchest when trade session becomes active
  useEffect(() => {
    if (tradeSession?.status === "active") {
      loadWarchestItems();
    }
  }, [loadWarchestItems, tradeSession?.status]);

  // Stop listening once the trade request expires.
  const tradeRequestId = tradeSession?.requestId ?? null;
  const tradeExpiresAt = tradeSession?.expiresAt ?? null;
  useEffect(() => {
    if (!tradeRequestId || !tradeExpiresAt) {
      return;
    }
    const timeoutMs = new Date(tradeExpiresAt).getTime() - Date.now();
    if (timeoutMs <= 0) {
      setExpiredRequestId(tradeRequestId);
      return;
    }
    const timer = window.setTimeout(() => setExpiredRequestId(tradeRequestId), timeoutMs);
    return () => window.clearTimeout(timer);
  }, [tradeExpiresAt, tradeRequestId]);

  // One subscription per trade request; URL or session-object changes no longer rebuild it.
  useTradeEvents(tradeRequestId !== expiredRequestId ? tradeRequestId : null, (message) => {
    if (!tradeSession) {
      return;
    }

    if (message.type === "trade.accepted") {
      const request = message.payload as TradeRequest;
      if (!request?.id) {
        return;
      }
      setTradeSession(buildTradeSession(request, "active"));
      setTradeRequest(request);
      const nextParams = new URLSearchParams(searchParams);
      if (!nextParams.get("trade")) {
        nextParams.set("trade", request.id);
        setSearchParams(nextParams, { replace: true });
      }
      return;
    }

    // Offers and locks move no gold: the event's request is all that changed (ECON-PERF-02).
    if (message.type === "trade.offer_updated" || message.type === "trade.locked") {
      const request = message.payload as TradeRequest;
      if (!request?.id) {
        return;
      }
      setTradeRequest(request);
      return;
    }

    if (message.type === "trade.completed") {
      const request = message.payload as TradeRequest;
      if (request?.id) {
        setTradeRequest(request);
      }
      if (tradeSession.requestId === request?.id) {
        setTradeSession(null);
        dropTradeParam();
      }
      if (warbandId) {
        updateWarbandCache(warbandId);
        loadWarchestItems();
      }
      return;
    }

    if (message.type === "trade.closed") {
      if (warbandId) {
        updateWarbandCache(warbandId);
      }
      setTradeSession(null);
      dropTradeParam();
    }
  });

  // The session's request, read once per trade (a session restored by another page, or kept
  // in the app store across pages); URL changes such as ?tab= don't read it again.
  useEffect(() => {
    if (!sessionRequestId || !canLoad) {
      setTradeRequest(null);
      return;
    }
    if (latest.current.tradeRequest?.id === sessionRequestId) {
      return;
    }
    let active = true;
    getTradeRequest(campaignId, sessionRequestId)
      .then((request) => {
        if (!active) {
          return;
        }
        if (isOver(request)) {
          setTradeSession(null);
          dropTradeParam();
          return;
        }
        setTradeRequest(request);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [campaignId, canLoad, dropTradeParam, sessionRequestId, setTradeSession]);

  return {
    tradeRequest,
    setTradeRequest,
    handleTradeRequestCreated,
    handleTradeSessionClose,
  };
}
