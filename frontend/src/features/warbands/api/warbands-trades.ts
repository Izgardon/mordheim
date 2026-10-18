import { apiRequest } from "../../../lib/api-client";

import type { WarbandTrade, WarbandTradeEdit, WarbandTradePayload } from "../types/warband-types";

export function listWarbandTrades(warbandId: number) {
  return apiRequest<WarbandTrade[]>(`/warbands/${warbandId}/trades/`);
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
