import { apiRequest } from "../../../lib/api-client";

import type { WarbandHero, WarbandHeroPayload } from "../types/warband-types";
import { emitWarbandUpdate, type WarbandUpdateOptions } from "./warbands-events";

export function listWarbandHeroes(warbandId: number) {
  return apiRequest<WarbandHero[]>(`/warbands/${warbandId}/heroes/`, {});
}

export function getWarbandHeroDetail(warbandId: number, heroId: number) {
  return apiRequest<WarbandHero>(`/warbands/${warbandId}/heroes/${heroId}/`);
}

export function listWarbandHeroDetails(warbandId: number) {
  return apiRequest<WarbandHero[]>(`/warbands/${warbandId}/heroes/detail/`);
}

export function createWarbandHero(
  warbandId: number,
  payload: WarbandHeroPayload,
  options: WarbandUpdateOptions = {}
) {
  const { emitUpdate = true } = options;
  return apiRequest<WarbandHero>(`/warbands/${warbandId}/heroes/`, {
    method: "POST",
    body: payload,
  }).then((data) => {
    if (emitUpdate) {
      emitWarbandUpdate(warbandId);
    }
    return data;
  });
}

export function updateWarbandHero(
  warbandId: number,
  heroId: number,
  payload: WarbandHeroPayload
) {
  return apiRequest<WarbandHero>(`/warbands/${warbandId}/heroes/${heroId}/`, {
    method: "PATCH",
    body: payload,
  });
}

export function deleteWarbandHero(
  warbandId: number,
  heroId: number,
  options: WarbandUpdateOptions = {}
) {
  const { emitUpdate = true } = options;
  return apiRequest<void>(`/warbands/${warbandId}/heroes/${heroId}/`, {
    method: "DELETE",
  }).then((data) => {
    if (emitUpdate) {
      emitWarbandUpdate(warbandId);
    }
    return data;
  });
}

export function levelUpWarbandHero(
  warbandId: number,
  heroId: number,
  payload: Record<string, unknown>
) {
  return apiRequest<WarbandHero>(
    `/warbands/${warbandId}/heroes/${heroId}/level-up/`,
    {
      method: "POST",
      body: { payload },
    }
  );
}
