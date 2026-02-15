import { apiRequest } from "../../../lib/api-client";

import type { HenchmenGroup, HenchmenGroupPayload } from "../types/warband-types";
import { emitWarbandUpdate, type WarbandUpdateOptions } from "./warbands-events";

export function listWarbandHenchmenGroups(warbandId: number) {
  return apiRequest<HenchmenGroup[]>(`/warbands/${warbandId}/henchmen-groups/`);
}

export function getWarbandHenchmenGroupDetail(warbandId: number, groupId: number) {
  return apiRequest<HenchmenGroup>(`/warbands/${warbandId}/henchmen-groups/${groupId}/`);
}

export function levelUpWarbandHenchmenGroup(
  warbandId: number,
  groupId: number,
  payload: Record<string, unknown>
) {
  return apiRequest<HenchmenGroup>(`/warbands/${warbandId}/henchmen-groups/${groupId}/level-up/`, {
    method: "POST",
    body: { payload },
  });
}

export function createWarbandHenchmenGroup(
  warbandId: number,
  payload: HenchmenGroupPayload,
  options: WarbandUpdateOptions = {}
) {
  const { emitUpdate = true } = options;
  return apiRequest<HenchmenGroup>(`/warbands/${warbandId}/henchmen-groups/`, {
    method: "POST",
    body: payload,
  }).then((data) => {
    if (emitUpdate) {
      emitWarbandUpdate(warbandId);
    }
    return data;
  });
}

export function updateWarbandHenchmenGroup(
  warbandId: number,
  groupId: number,
  payload: HenchmenGroupPayload
) {
  return apiRequest<HenchmenGroup>(`/warbands/${warbandId}/henchmen-groups/${groupId}/`, {
    method: "PATCH",
    body: payload,
  });
}

export function deleteWarbandHenchmenGroup(
  warbandId: number,
  groupId: number,
  options: WarbandUpdateOptions = {}
) {
  const { emitUpdate = true } = options;
  return apiRequest<void>(`/warbands/${warbandId}/henchmen-groups/${groupId}/`, {
    method: "DELETE",
  }).then((data) => {
    if (emitUpdate) {
      emitWarbandUpdate(warbandId);
    }
    return data;
  });
}
