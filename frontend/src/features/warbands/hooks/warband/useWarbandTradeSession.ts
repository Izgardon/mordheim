import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useSearchParams } from "react-router-dom";

import { useAppStore } from "@/stores/app-store";
import { useAuth } from "../../../auth/hooks/use-auth";
import { closeTradeRequest, createTradeRequest, getTradeRequest } from "../../../campaigns/api/campaigns-api";
import { emitWarbandUpdate } from "../../api/warbands-events";
import { createTradeSessionSocket } from "@/lib/realtime";

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
  const tradeSocketRef = useRef<ReturnType<typeof createTradeSessionSocket> | null>(null);
  const tradeTimeoutRef = useRef<number | null>(null);

  const tradeRequestParam = searchParams.get("trade");

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
      if (!hasCampaignId || Number.isNaN(campaignId) || !user) {
        return;
      }
      const request = await createTradeRequest(campaignId, targetUserId);
      setTradeSession(buildTradeSession(request, "pending"));
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set("trade", request.id);
      setSearchParams(nextParams);
    },
    [buildTradeSession, campaignId, hasCampaignId, searchParams, setSearchParams, setTradeSession, user]
  );

  const handleTradeSessionClose = useCallback(() => {
    if (tradeSession && hasCampaignId && !Number.isNaN(campaignId)) {
      closeTradeRequest(campaignId, tradeSession.requestId).catch(() => {});
    }
    setTradeSession(null);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("trade");
    setSearchParams(nextParams);
  }, [campaignId, hasCampaignId, searchParams, setSearchParams, setTradeSession, tradeSession]);

  // Restore trade session from URL param on mount / URL change
  useEffect(() => {
    if (!tradeRequestParam || !hasCampaignId || !user || Number.isNaN(campaignId)) {
      return;
    }
    if (tradeSession?.requestId === tradeRequestParam) {
      return;
    }
    getTradeRequest(campaignId, tradeRequestParam)
      .then((request) => {
        if (request.status === "declined" || request.status === "expired") {
          setTradeSession(null);
          const nextParams = new URLSearchParams(searchParams);
          nextParams.delete("trade");
          setSearchParams(nextParams);
          return;
        }
        const status = request.status === "accepted" ? "active" : "pending";
        setTradeSession(buildTradeSession(request, status));
      })
      .catch(() => undefined);
  }, [
    buildTradeSession,
    campaignId,
    hasCampaignId,
    setTradeSession,
    tradeRequestParam,
    tradeSession?.requestId,
    user,
  ]);

  // Load warchest when trade session becomes active
  useEffect(() => {
    if (tradeSession?.status === "active") {
      loadWarchestItems();
    }
  }, [loadWarchestItems, tradeSession?.status]);

  // Manage WebSocket lifecycle for the active trade session
  useEffect(() => {
    if (!tradeSession) {
      tradeSocketRef.current?.close();
      tradeSocketRef.current = null;
      setTradeRequest(null);
      if (tradeTimeoutRef.current) {
        window.clearTimeout(tradeTimeoutRef.current);
        tradeTimeoutRef.current = null;
      }
      return;
    }

    tradeSocketRef.current?.close();
    tradeSocketRef.current = null;
    if (tradeTimeoutRef.current) {
      window.clearTimeout(tradeTimeoutRef.current);
      tradeTimeoutRef.current = null;
    }

    const socket = createTradeSessionSocket(tradeSession.requestId, (message) => {
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
          setSearchParams(nextParams);
        }
        return;
      }

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
        if (tradeSession?.requestId === request?.id) {
          setTradeSession(null);
          const nextParams = new URLSearchParams(searchParams);
          nextParams.delete("trade");
          setSearchParams(nextParams);
        }
        if (warbandId) {
          emitWarbandUpdate(warbandId);
          loadWarchestItems();
        }
        return;
      }

      if (message.type === "trade.closed") {
        setTradeSession(null);
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete("trade");
        setSearchParams(nextParams);
      }
    });

    tradeSocketRef.current = socket;

    const expiresAtMs = new Date(tradeSession.expiresAt).getTime();
    const now = Date.now();
    const timeoutMs = expiresAtMs - now;
    if (timeoutMs > 0) {
      tradeTimeoutRef.current = window.setTimeout(() => {
        socket.close();
      }, timeoutMs);
    } else {
      socket.close();
    }

    return () => {
      socket.close();
      if (tradeTimeoutRef.current) {
        window.clearTimeout(tradeTimeoutRef.current);
        tradeTimeoutRef.current = null;
      }
    };
  }, [
    buildTradeSession,
    loadWarchestItems,
    searchParams,
    setSearchParams,
    setTradeSession,
    tradeSession,
    warbandId,
  ]);

  // Sync local tradeRequest state with server (handles session already existing on mount)
  useEffect(() => {
    if (!tradeSession || !hasCampaignId || Number.isNaN(campaignId)) {
      setTradeRequest(null);
      return;
    }
    getTradeRequest(campaignId, tradeSession.requestId)
      .then((request) => {
        if (
          request.status === "declined" ||
          request.status === "expired" ||
          request.status === "completed"
        ) {
          setTradeSession(null);
          const nextParams = new URLSearchParams(searchParams);
          nextParams.delete("trade");
          setSearchParams(nextParams);
          return;
        }
        setTradeRequest(request);
      })
      .catch(() => {});
  }, [
    campaignId,
    hasCampaignId,
    searchParams,
    setSearchParams,
    setTradeSession,
    tradeSession?.requestId,
  ]);

  return {
    tradeRequest,
    setTradeRequest,
    handleTradeRequestCreated,
    handleTradeSessionClose,
  };
}
