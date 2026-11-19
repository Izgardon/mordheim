import { apiRequest } from "../../../lib/api-client";
import { socketIdHeaders } from "@/lib/realtime/socket-headers";

import type {
  WarbandItemMaterialPayload,
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
    headers: socketIdHeaders(),
    body: payload,
  });
}

export function sellWarbandItem(warbandId: number, payload: WarbandItemSalePayload) {
  return apiRequest<WarbandItemMutationResponse>(`/warbands/${warbandId}/item-sales/`, {
    method: "POST",
    headers: socketIdHeaders(),
    body: payload,
  });
}

/** Puts a material on a weapon the warband already owns (weapon materials): the server charges it. */
export function applyWarbandItemMaterial(warbandId: number, payload: WarbandItemMaterialPayload) {
  return apiRequest<WarbandItemMutationResponse>(`/warbands/${warbandId}/item-materials/`, {
    method: "POST",
    headers: socketIdHeaders(),
    body: payload,
  });
}
