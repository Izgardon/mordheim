import { apiRequest } from "../../../lib/api-client";

import type { WarbandResource, WarbandTrade, WarbandUnitsSummary } from "../types/warband-types";

/** `POST resources/<id>/sell/`: the resource, its "Sell" ledger row and the new summary. */
export type WarbandResourceSale = {
  resource: WarbandResource;
  trade: WarbandTrade;
  summary: WarbandUnitsSummary;
};

export function listWarbandResources(warbandId: number) {
  return apiRequest<WarbandResource[]>(`/warbands/${warbandId}/resources/`);
}

export function createWarbandResource(warbandId: number, payload: { name: string }) {
  return apiRequest<WarbandResource>(`/warbands/${warbandId}/resources/`, {
    method: "POST",
    body: payload,
  });
}

/** `{ delta }` adds to the stored amount in the database (never below 0); `{ amount }` sets it. */
export function updateWarbandResource(
  warbandId: number,
  resourceId: number,
  payload: { delta: number } | { amount: number }
) {
  return apiRequest<WarbandResource>(`/warbands/${warbandId}/resources/${resourceId}/`, {
    method: "PATCH",
    body: payload,
  });
}

/** Sells `quantity` and records the sale in one request (BUG-68). */
export function sellWarbandResource(
  warbandId: number,
  resourceId: number,
  payload: { quantity: number; price: number }
) {
  return apiRequest<WarbandResourceSale>(`/warbands/${warbandId}/resources/${resourceId}/sell/`, {
    method: "POST",
    body: payload,
  });
}

export function deleteWarbandResource(warbandId: number, resourceId: number) {
  return apiRequest<void>(`/warbands/${warbandId}/resources/${resourceId}/`, {
    method: "DELETE",
  });
}
