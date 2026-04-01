import { apiRequest } from "../../../lib/api-client";

import type {
  WarbandItemMutationResponse,
  WarbandItemSalePayload,
  WarbandItemSummary,
  WarbandItemTransferPayload,
} from "../types/warband-types";
import { emitWarbandUpdate } from "./warbands-events";

export function listWarbandItems(warbandId: number) {
  return apiRequest<WarbandItemSummary[]>(`/warbands/${warbandId}/items/`);
}

export function removeWarbandItem(
  warbandId: number,
  itemId: number,
  quantity = 1,
  options: { emitUpdate?: boolean } = {}
) {
  const { emitUpdate = true } = options;
  return apiRequest<void>(`/warbands/${warbandId}/items/${itemId}/`, {
    method: "DELETE",
    body: { quantity },
  }).then((data) => {
    if (emitUpdate) {
      emitWarbandUpdate(warbandId);
    }
    return data;
  });
}

export function addWarbandItem(
  warbandId: number,
  itemId: number,
  options: { emitUpdate?: boolean; quantity?: number; cost?: number | null } = {}
) {
  const { quantity = 1, cost } = options;
  const { emitUpdate = true } = options;
  return apiRequest<WarbandItemSummary>(`/warbands/${warbandId}/items/`, {
    method: "POST",
    body: {
      item_id: itemId,
      quantity,
      ...(cost != null ? { cost } : {}),
    },
  }).then((data) => {
    if (emitUpdate) {
      emitWarbandUpdate(warbandId);
    }
    return data;
  });
}

export function transferWarbandItem(
  warbandId: number,
  payload: WarbandItemTransferPayload
) {
  return apiRequest<WarbandItemMutationResponse>(`/warbands/${warbandId}/item-transfers/`, {
    method: "POST",
    body: payload,
  });
}

export function sellWarbandItem(
  warbandId: number,
  payload: WarbandItemSalePayload
) {
  return apiRequest<WarbandItemMutationResponse>(`/warbands/${warbandId}/item-sales/`, {
    method: "POST",
    body: payload,
  });
}
