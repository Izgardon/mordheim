import type { TradeRequest, TradeSession } from "../types/trade-request-types";

/** A request that can no longer be traded on. */
export const isTradeOver = (request: TradeRequest) =>
  request.status === "declined" ||
  request.status === "cancelled" ||
  request.status === "expired" ||
  request.status === "completed";

/**
 * How a trade ended, for the player `userId`: "cancelled" is the sender closing it (BUG-115),
 * "declined" the recipient turning it down or closing it. Null while it is still open.
 */
export function describeTradeEnd(request: TradeRequest, userId?: number | null): string | null {
  const isSender = request.from_user.id === userId;
  switch (request.status) {
    case "cancelled":
      return isSender
        ? "You cancelled the trade."
        : `${request.from_user.label} cancelled the trade.`;
    case "declined":
      return isSender ? `${request.to_user.label} declined the trade.` : "You declined the trade.";
    case "expired":
      return "The trade request expired.";
    case "completed":
      return "The trade is complete.";
    default:
      return null;
  }
}

/**
 * The trade as player `userId` sees it: their role, their partner, and whether it is open
 * ("active", once accepted) or still waiting for an answer ("pending").
 */
export function toTradeSession(request: TradeRequest, userId: number): TradeSession {
  const role = request.from_user.id === userId ? "initiator" : "recipient";
  return {
    requestId: request.id,
    campaignId: request.campaign_id,
    partner: role === "initiator" ? request.to_user : request.from_user,
    fromWarband: request.from_warband,
    toWarband: request.to_warband,
    status: request.status === "accepted" ? "active" : "pending",
    expiresAt: request.expires_at,
    role,
  };
}
