import { useEffect, useState } from "react";
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
};

/**
 * The open trade's realtime channel, one subscription per trade, dropped once the request expires
 * (BUG-69: the dialog stays open; PR C's countdown and `trade_closed` close it). Each event's
 * payload is the trade as it now is, so it goes straight into the trade query (ECON-PERF-02).
 */
export function useTradeChannel({ session, onCompleted, onClosed }: UseTradeChannelOptions) {
  const queryClient = useQueryClient();
  const [expiredRequestId, setExpiredRequestId] = useState<string | null>(null);
  const requestId = session?.requestId ?? null;
  const expiresAt = session?.expiresAt ?? null;

  useEffect(() => {
    if (!requestId || !expiresAt) {
      return;
    }
    const timeoutMs = new Date(expiresAt).getTime() - Date.now();
    if (timeoutMs <= 0) {
      setExpiredRequestId(requestId);
      return;
    }
    const timer = window.setTimeout(() => setExpiredRequestId(requestId), timeoutMs);
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
