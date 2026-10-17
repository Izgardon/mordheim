import { ApiError } from "@/lib/api-client";
import { apiErrorCode, getErrorMessage } from "@/lib/get-error-message";

import type { TradeRequest } from "../types/trade-request-types";

/** Why a completion failed, as a refused lock answers it and the partner's event carries it. */
export type TradeCompletionError = { detail?: string; code?: string; warband_id?: number };

type TradeErrorBody = TradeCompletionError & { trade?: TradeRequest; trade_id?: string };

const bodyOf = (error: unknown): TradeErrorBody =>
  error instanceof ApiError && error.data && typeof error.data === "object"
    ? (error.data as TradeErrorBody)
    : {};

/** The trade a refused write answers with (e.g. the offers that changed), to show as it is now. */
export const tradeFromError = (error: unknown): TradeRequest | null => bodyOf(error).trade ?? null;

/** The trade already open with this player when a new request is refused (BUG-114). */
export const openTradeIdFromError = (error: unknown): string | null =>
  apiErrorCode(error) === "trade_already_open" ? (bodyOf(error).trade_id ?? null) : null;

/** A failed completion, naming the warband whose side stopped it: both sides are unlocked. */
export function completionFailureMessage(
  failure: TradeCompletionError,
  trade?: TradeRequest | null
) {
  const warband = [trade?.from_warband, trade?.to_warband].find(
    (entry) => entry && entry.id === failure.warband_id
  );
  const reason = failure.detail || "It couldn't go through.";
  return `The trade couldn't complete: ${warband ? `${warband.name}: ` : ""}${reason} Both sides are unlocked.`;
}

/** The other player left the campaign: say so, and that backing out still works (SEC-08). */
const partnerLeftMessage = (error: unknown) =>
  `${getErrorMessage(error)} You can still unaccept or cancel the trade.`;

/** What to tell the player when an offer save is refused. */
export function offerErrorMessage(error: unknown): string {
  if (apiErrorCode(error) === "trade_partner_left") {
    return partnerLeftMessage(error);
  }
  return getErrorMessage(error, "Unable to update offer.");
}

/** What to tell the player when their lock (Accept) is refused. */
export function lockErrorMessage(error: unknown): string {
  const code = apiErrorCode(error);
  if (code === "offer_changed") {
    return "The other side changed the offer. Check it and accept again.";
  }
  if (code === "trade_completion_failed") {
    return completionFailureMessage(
      { ...bodyOf(error), detail: getErrorMessage(error) },
      tradeFromError(error)
    );
  }
  if (code === "trade_partner_left") {
    return partnerLeftMessage(error);
  }
  return getErrorMessage(error, "Unable to accept trade.");
}
