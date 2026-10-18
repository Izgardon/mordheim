import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { readTradeData, setTradeData } from "@/features/warbands/api/economy-queries";
import { describeTradeEnd, isTradeOver } from "@/features/warbands/utils/trade-status";
import { toTradeNotification } from "./notification-mappers";

import type {
  TradeNotification,
  TradeRequest,
} from "@/features/warbands/types/trade-request-types";

/** Long enough to read and act on; the bell remains afterwards. */
const ACTIONABLE_TOAST_MS = 12_000;

export type TradeNotificationContext = {
  queryClient: QueryClient;
  userId: number;
  location: { pathname: string; search: string };
  navigate: (path: string) => void;
  addTradeRequestNotification: (notification: TradeNotification) => void;
  removeTradeRequestNotification: (notificationId: string) => void;
};

/** A trade this browser shows ends: it takes the server's copy, and the player is told why. */
function endKnownTrade(request: TradeRequest, fallback: string, ctx: TradeNotificationContext) {
  ctx.removeTradeRequestNotification(request.id);
  // A warband page showing the trade drops ?trade= on its own once its copy has ended.
  const known = readTradeData(ctx.queryClient, request.campaign_id, request.id);
  if (known && !isTradeOver(known)) {
    setTradeData(ctx.queryClient, request);
    toast(describeTradeEnd(request, ctx.userId) ?? fallback, { id: `trade-ended-${request.id}` });
  }
}

/** The partner accepted: offer the trade instead of navigating away (BUG-26). */
function offerAcceptedTrade(request: TradeRequest, ctx: TradeNotificationContext) {
  // The trade channel may have told us first: the trade is already open here.
  if (readTradeData(ctx.queryClient, request.campaign_id, request.id)?.status === "accepted") {
    return;
  }
  setTradeData(ctx.queryClient, request);
  const isTradeOpen =
    ctx.location.pathname === `/campaigns/${request.campaign_id}/warband` &&
    new URLSearchParams(ctx.location.search).get("trade") === request.id;
  if (isTradeOpen) {
    return;
  }
  const partner = request.from_user.id === ctx.userId ? request.to_user : request.from_user;
  toast(`${partner.label} accepted your trade`, {
    id: `trade-accepted-${request.id}`,
    duration: ACTIONABLE_TOAST_MS,
    action: {
      label: "Open trade",
      onClick: () => ctx.navigate(`/campaigns/${request.campaign_id}/warband?trade=${request.id}`),
    },
  });
}

/**
 * A `trade_*` event on the player's notification channel. Answers false for any other event.
 * `trade_closed` (decision 8) comes to both players for a trade that completed, was declined
 * or was cancelled. Expiry sends nothing: each page closes the trade from its countdown.
 */
export function handleTradeNotification(
  message: { type: string; payload?: unknown },
  ctx: TradeNotificationContext
) {
  if (!message.type.startsWith("trade_")) {
    return false;
  }
  const request = message.payload as (TradeRequest & { notification_id?: number }) | undefined;
  if (!request?.id) {
    return true;
  }
  if (message.type === "trade_request") {
    ctx.addTradeRequestNotification(toTradeNotification(request, request.notification_id ?? 0));
  } else if (message.type === "trade_accepted") {
    offerAcceptedTrade(request, ctx);
  } else if (message.type === "trade_declined") {
    endKnownTrade(request, "The trade was declined.", ctx);
  } else if (message.type === "trade_closed") {
    endKnownTrade(request, "The trade is over.", ctx);
  }
  return true;
}
