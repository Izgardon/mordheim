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

export function addWarbandItem(
  warbandId: number,
  itemId: number,
  options: { quantity?: number; cost?: number | null } = {}
) {
  const { quantity = 1, cost } = options;
  return apiRequest<WarbandItemSummary>(`/warbands/${warbandId}/items/`, {
    method: "POST",
    body: {
      item_id: itemId,
      quantity,
      ...(cost != null ? { cost } : {}),
    },
  });
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
