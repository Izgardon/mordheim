import type { TradeRequest } from "../types/trade-request-types";

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
