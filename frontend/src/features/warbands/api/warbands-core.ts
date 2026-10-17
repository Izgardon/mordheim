import { apiRequest } from "../../../lib/api-client";

import type { Restriction } from "../../items/types/item-types";
import type { WarbandSheet } from "../types/warband-sheet";
import type {
  Warband,
  WarbandCreatePayload,
  WarbandUpdatePayload,
  WarbandUnitsSummary,
} from "../types/warband-types";

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

/** The warband page in one request: warband, summary, capabilities and the three unit lists. */
export function getWarbandSheet(warbandId: number) {
  return apiRequest<WarbandSheet>(`/warbands/${warbandId}/sheet/`);
}

export function createWarband(campaignId: number, payload: WarbandCreatePayload) {
  return apiRequest<Warband>("/warbands/", {
    method: "POST",
    body: {
      ...payload,
      campaign_id: campaignId,
    },
  });
}

export function updateWarband(warbandId: number, payload: Partial<WarbandUpdatePayload>) {
  return apiRequest<Warband>(`/warbands/${warbandId}/`, {
    method: "PATCH",
    body: payload,
  });
}

export function deleteWarband(warbandId: number) {
  return apiRequest<void>(`/warbands/${warbandId}/`, {
    method: "DELETE",
  });
}

export function getWarbandRestrictions(warbandId: number) {
  return apiRequest<Restriction[]>(`/warbands/${warbandId}/restrictions/`);
}

export function updateWarbandRestrictions(warbandId: number, restrictionIds: number[]) {
  return apiRequest<Restriction[]>(`/warbands/${warbandId}/restrictions/`, {
    method: "PUT",
    body: { restriction_ids: restrictionIds },
  });
}
