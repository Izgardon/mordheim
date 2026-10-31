import { apiRequest } from "../../../lib/api-client";

import type {
  WarbandItemMutationResponse,
  WarbandItemSalePayload,
  WarbandItemSummary,
  WarbandItemTransferPayload,
} from "../types/warband-types";

export function listWarbandItems(warbandId: number) {
  return apiRequest<WarbandItemSummary[]>(`/warbands/${warbandId}/items/`);
}

export function transferWarbandItem(warbandId: number, payload: WarbandItemTransferPayload) {
  return apiRequest<WarbandItemMutationResponse>(`/warbands/${warbandId}/item-transfers/`, {
    method: "POST",
    body: payload,
  });
}

export function sellWarbandItem(warbandId: number, payload: WarbandItemSalePayload) {
  return apiRequest<WarbandItemMutationResponse>(`/warbands/${warbandId}/item-sales/`, {
    method: "POST",
    body: payload,
  });
}
