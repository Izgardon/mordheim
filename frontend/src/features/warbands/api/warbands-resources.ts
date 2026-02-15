import { apiRequest } from "../../../lib/api-client";

import type { WarbandResource } from "../types/warband-types";
import { emitWarbandUpdate, type WarbandUpdateOptions } from "./warbands-events";

export function createWarbandResource(
  warbandId: number,
  payload: { name: string },
  options: WarbandUpdateOptions = {}
) {
  const { emitUpdate = true } = options;
  return apiRequest<WarbandResource>(`/warbands/${warbandId}/resources/`, {
    method: "POST",
    body: payload,
  }).then((data) => {
    if (emitUpdate) {
      emitWarbandUpdate(warbandId);
    }
    return data;
  });
}

export function updateWarbandResource(
  warbandId: number,
  resourceId: number,
  payload: { amount: number },
  options: WarbandUpdateOptions = {}
) {
  const { emitUpdate = true } = options;
  return apiRequest<WarbandResource>(`/warbands/${warbandId}/resources/${resourceId}/`, {
    method: "PATCH",
    body: payload,
  }).then((data) => {
    if (emitUpdate) {
      emitWarbandUpdate(warbandId);
    }
    return data;
  });
}

export function deleteWarbandResource(
  warbandId: number,
  resourceId: number,
  options: WarbandUpdateOptions = {}
) {
  const { emitUpdate = true } = options;
  return apiRequest<void>(`/warbands/${warbandId}/resources/${resourceId}/`, {
    method: "DELETE",
  }).then((data) => {
    if (emitUpdate) {
      emitWarbandUpdate(warbandId);
    }
    return data;
  });
}
