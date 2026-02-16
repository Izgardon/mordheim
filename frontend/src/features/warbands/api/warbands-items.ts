import { apiRequest } from "../../../lib/api-client";

import type { WarbandItemSummary } from "../types/warband-types";
import { emitWarbandUpdate } from "./warbands-events";

export function listWarbandItems(warbandId: number) {
  return apiRequest<WarbandItemSummary[]>(`/warbands/${warbandId}/items/`);
}

export function removeWarbandItem(
  warbandId: number,
  itemId: number,
  quantity = 1
) {
  return apiRequest<void>(`/warbands/${warbandId}/items/${itemId}/`, {
    method: "DELETE",
    body: { quantity },
  }).then((data) => {
    emitWarbandUpdate(warbandId);
    return data;
  });
}

export function addWarbandItem(
  warbandId: number,
  itemId: number,
  options: { emitUpdate?: boolean; quantity?: number } = {}
) {
  const { quantity = 1 } = options;
  const { emitUpdate = true } = options;
  return apiRequest<WarbandItemSummary>(`/warbands/${warbandId}/items/`, {
    method: "POST",
    body: {
      item_id: itemId,
      quantity,
    },
  }).then((data) => {
    if (emitUpdate) {
      emitWarbandUpdate(warbandId);
    }
    return data;
  });
}
