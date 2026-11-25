import { apiRequest } from "../../../lib/api-client";
import { socketIdHeaders } from "@/lib/realtime/socket-headers";
import type { WarbandSheet } from "../types/warband-sheet";
import type {
  Warband,
  WarbandCreatePayload,
  WarbandUpdatePayload,
  WarbandRecordBattle,
  WarbandRulesChanged,
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

/** Its last ten ended battles, newest first, each with its result and the other warbands. */
export function getWarbandRecord(warbandId: number) {
  return apiRequest<WarbandRecordBattle[]>(`/warbands/${warbandId}/record/`);
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

/** The warband as saved, and what a new variant or type did to its rules. */
export type WarbandUpdateAnswer = Warband & { rules_changed?: WarbandRulesChanged | null };

export function updateWarband(warbandId: number, payload: Partial<WarbandUpdatePayload>) {
  return apiRequest<WarbandUpdateAnswer>(`/warbands/${warbandId}/`, {
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
