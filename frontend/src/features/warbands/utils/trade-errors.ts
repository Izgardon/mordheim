import { ApiError } from "@/lib/api-client";
import { apiErrorCode, getErrorMessage } from "@/lib/get-error-message";

import type { TradeRequest } from "../types/trade-request-types";

type TradeErrorBody = { trade?: TradeRequest };

const bodyOf = (error: unknown): TradeErrorBody =>
  error instanceof ApiError && error.data && typeof error.data === "object"
    ? (error.data as TradeErrorBody)
    : {};

/** The trade a refused write answers with (e.g. the offers that changed), to show as it is now. */
export const tradeFromError = (error: unknown): TradeRequest | null => bodyOf(error).trade ?? null;

/** What to tell the player when their lock (Accept) is refused. */
export function lockErrorMessage(error: unknown): string {
  if (apiErrorCode(error) === "offer_changed") {
    return "The other side changed the offer. Check it and accept again.";
  }
  return getErrorMessage(error, "Unable to accept trade.");
}
