import { apiRequest } from "../../../lib/api-client";

import type { Warband, WarbandCreatePayload, WarbandUpdatePayload, WarbandUnitsSummary } from "../types/warband-types";
import { emitWarbandUpdate, type WarbandUpdateOptions } from "./warbands-events";

export async function getWarband(campaignId: number) {
  const data = await apiRequest<Warband[]>(
    `/warbands/?campaign_id=${encodeURIComponent(campaignId)}`
  );
  return data[0] ?? null;
}

export function getWarbandById(warbandId: number) {
  return apiRequest<Warband>(`/warbands/${warbandId}/`);
}

export function getWarbandSummary(warbandId: number) {
  return apiRequest<WarbandUnitsSummary>(`/warbands/${warbandId}/summary/`);
}

export function createWarband(campaignId: number, payload: WarbandCreatePayload) {
  return apiRequest<Warband>("/warbands/", {
    method: "POST",
    body: {
      ...payload,
      campaign_id: campaignId,
    },
  }).then((data) => {
    if (data?.id) {
      emitWarbandUpdate(data.id);
    }
    return data;
  });
}

export function updateWarband(
  warbandId: number,
  payload: Partial<WarbandUpdatePayload>,
  options: WarbandUpdateOptions = {}
) {
  const { emitUpdate = true } = options;
  return apiRequest<Warband>(`/warbands/${warbandId}/`, {
    method: "PATCH",
    body: payload,
  }).then((data) => {
    if (emitUpdate) {
      emitWarbandUpdate(warbandId);
    }
    return data;
  });
}

export function deleteWarband(warbandId: number) {
  return apiRequest<void>(`/warbands/${warbandId}/`, {
    method: "DELETE",
  }).then((data) => {
    emitWarbandUpdate(warbandId);
    return data;
  });
}
