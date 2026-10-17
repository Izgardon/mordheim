import { apiRequest } from "../../../lib/api-client";

import type { WarbandTrade, WarbandTradePayload } from "../types/warband-types";

export function listWarbandTrades(warbandId: number) {
  return apiRequest<WarbandTrade[]>(`/warbands/${warbandId}/trades/`);
}

export function createWarbandTrade(warbandId: number, payload: WarbandTradePayload) {
  return apiRequest<WarbandTrade>(`/warbands/${warbandId}/trades/`, {
    method: "POST",
    body: payload,
  });
}
