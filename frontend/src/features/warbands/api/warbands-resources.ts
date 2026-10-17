import { apiRequest } from "../../../lib/api-client";

import type { WarbandResource } from "../types/warband-types";

export function listWarbandResources(warbandId: number) {
  return apiRequest<WarbandResource[]>(`/warbands/${warbandId}/resources/`);
}

export function createWarbandResource(warbandId: number, payload: { name: string }) {
  return apiRequest<WarbandResource>(`/warbands/${warbandId}/resources/`, {
    method: "POST",
    body: payload,
  });
}

export function updateWarbandResource(
  warbandId: number,
  resourceId: number,
  payload: { amount: number }
) {
  return apiRequest<WarbandResource>(`/warbands/${warbandId}/resources/${resourceId}/`, {
    method: "PATCH",
    body: payload,
  });
}

export function deleteWarbandResource(warbandId: number, resourceId: number) {
  return apiRequest<void>(`/warbands/${warbandId}/resources/${resourceId}/`, {
    method: "DELETE",
  });
}
