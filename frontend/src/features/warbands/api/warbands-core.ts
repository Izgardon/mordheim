import { apiRequest } from "../../../lib/api-client";
import { socketIdHeaders } from "@/lib/realtime/socket-headers";
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

export function getWarbandSummary(warbandId: number) {
  return apiRequest<WarbandUnitsSummary>(`/warbands/${warbandId}/summary/`);
}

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
    headers: socketIdHeaders(),
    body: payload,
  });
}

export function deleteWarband(warbandId: number) {
  return apiRequest<void>(`/warbands/${warbandId}/`, {
    method: "DELETE",
    headers: socketIdHeaders(),
  });
}
