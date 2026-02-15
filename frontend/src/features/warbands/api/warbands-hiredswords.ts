import { apiRequest } from "../../../lib/api-client";

import type { WarbandHiredSword, WarbandHiredSwordPayload } from "../types/warband-types";
import { emitWarbandUpdate, type WarbandUpdateOptions } from "./warbands-events";

export function listWarbandHiredSwords(warbandId: number) {
  return apiRequest<WarbandHiredSword[]>(`/warbands/${warbandId}/hired-swords/`);
}

export function listWarbandHiredSwordDetails(warbandId: number) {
  return apiRequest<WarbandHiredSword[]>(`/warbands/${warbandId}/hired-swords/detail/`);
}

export function getWarbandHiredSwordDetail(warbandId: number, hiredSwordId: number) {
  return apiRequest<WarbandHiredSword>(`/warbands/${warbandId}/hired-swords/${hiredSwordId}/`);
}

export function createWarbandHiredSword(
  warbandId: number,
  payload: WarbandHiredSwordPayload,
  options: WarbandUpdateOptions = {}
) {
  const { emitUpdate = true } = options;
  return apiRequest<WarbandHiredSword>(`/warbands/${warbandId}/hired-swords/`, {
    method: "POST",
    body: payload,
  }).then((data) => {
    if (emitUpdate) {
      emitWarbandUpdate(warbandId);
    }
    return data;
  });
}

export function updateWarbandHiredSword(
  warbandId: number,
  hiredSwordId: number,
  payload: WarbandHiredSwordPayload
) {
  return apiRequest<WarbandHiredSword>(
    `/warbands/${warbandId}/hired-swords/${hiredSwordId}/`,
    {
      method: "PATCH",
      body: payload,
    }
  );
}

export function deleteWarbandHiredSword(
  warbandId: number,
  hiredSwordId: number,
  options: WarbandUpdateOptions = {}
) {
  const { emitUpdate = true } = options;
  return apiRequest<void>(`/warbands/${warbandId}/hired-swords/${hiredSwordId}/`, {
    method: "DELETE",
  }).then((data) => {
    if (emitUpdate) {
      emitWarbandUpdate(warbandId);
    }
    return data;
  });
}

export function levelUpWarbandHiredSword(
  warbandId: number,
  hiredSwordId: number,
  payload: Record<string, unknown>
) {
  return apiRequest<WarbandHiredSword>(
    `/warbands/${warbandId}/hired-swords/${hiredSwordId}/level-up/`,
    {
      method: "POST",
      body: { payload },
    }
  );
}
