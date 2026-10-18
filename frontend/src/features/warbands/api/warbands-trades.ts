import { apiRequest } from "../../../lib/api-client";
import { pagePath, type CursorPage } from "./cursor-pages";

import type { WarbandTrade, WarbandTradeEdit, WarbandTradePayload } from "../types/warband-types";

/** One page of the ledger, newest first: top-level rows with their children (ECON-PERF-06). */
export function listWarbandTradePage(
  warbandId: number,
  page: { limit: number; cursor?: string | null }
) {
  return apiRequest<CursorPage<WarbandTrade>>(pagePath(`/warbands/${warbandId}/trades/`, page));
}

export function createWarbandTrade(warbandId: number, payload: WarbandTradePayload) {
  return apiRequest<WarbandTrade>(`/warbands/${warbandId}/trades/`, {
    method: "POST",
    body: payload,
  });
}

/** A hand-entered row's description or notes; there is no way to change or delete an amount. */
export function updateWarbandTrade(warbandId: number, tradeId: number, payload: WarbandTradeEdit) {
  return apiRequest<WarbandTrade>(`/warbands/${warbandId}/trades/${tradeId}/`, {
    method: "PATCH",
    body: payload,
  });
}
