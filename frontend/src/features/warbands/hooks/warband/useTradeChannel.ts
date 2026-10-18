import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useTradeEvents } from "@/lib/realtime";
import { setTradeData } from "../../api/economy-queries";
import { completionFailureMessage, type TradeCompletionError } from "../../utils/trade-errors";

import type { TradeCompletion, TradeRequest, TradeSession } from "../../types/trade-request-types";

type UseTradeChannelOptions = {
  session: TradeSession | null;
  /** A completed trade: `endsSession` when it is the trade on screen. */
  onCompleted: (request: TradeCompletion, endsSession: boolean) => void;
  /** The partner closed the trade (the payload says how, when it has one). */
  onClosed: (request: TradeRequest | undefined) => void;
  /** The trade's time ran out (the server's cron closes it up to 5 minutes later). */
  onExpired: (requestId: string) => void;
};

/**
 * The open trade's realtime channel, one subscription per trade, and its deadline: when
 * `expires_at` passes (it moves with every event and answer), the page is told and the
 * subscription drops (BUG-69). Each event's payload is the trade as it now is, so it goes
 * straight into the trade query (ECON-PERF-02).
 */
export function useTradeChannel({
  session,
  onCompleted,
  onClosed,
  onExpired,
}: UseTradeChannelOptions) {
  const queryClient = useQueryClient();
  const [expiredRequestId, setExpiredRequestId] = useState<string | null>(null);
  const requestId = session?.requestId ?? null;
  const expiresAt = session?.expiresAt ?? null;

  const onExpiredRef = useRef(onExpired);
  onExpiredRef.current = onExpired;
  useEffect(() => {
    if (!requestId || !expiresAt) {
      return;
    }
    const expire = () => {
      setExpiredRequestId(requestId);
      onExpiredRef.current(requestId);
    };
    const timeoutMs = new Date(expiresAt).getTime() - Date.now();
    if (timeoutMs <= 0) {
      expire();
      return;
    }
    const timer = window.setTimeout(expire, timeoutMs);
    return () => window.clearTimeout(timer);
  }, [expiresAt, requestId]);

  useTradeEvents(requestId !== expiredRequestId ? requestId : null, (message) => {
    if (!session) {
      return;
    }

    // Accepted, offers and locks move no gold: the event's trade is all that changed.
    if (
      message.type === "trade.accepted" ||
      message.type === "trade.offer_updated" ||
      message.type === "trade.locked"
    ) {
      const request = message.payload as TradeRequest & { error?: TradeCompletionError };
      if (!request?.id) {
        return;
      }
      setTradeData(queryClient, request);
      // The partner's lock couldn't complete the trade: both sides are unlocked again.
      if (message.type !== "trade.accepted" && request.error) {
        toast.error(completionFailureMessage(request.error, request), {
          id: `trade-failed-${request.id}-${request.offer_version ?? 0}`,
        });
      }
      return;
    }

    if (message.type === "trade.completed") {
      const request = message.payload as TradeCompletion;
      if (request?.id) {
        onCompleted(request, session.requestId === request.id);
      }
      return;
    }

    if (message.type === "trade.closed") {
      onClosed(message.payload as TradeRequest | undefined);
    }
  });
}
