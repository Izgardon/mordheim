// api
import { apiRequest } from "../../../lib/api-client";

// types
import type {
  Warband,
  WarbandCreatePayload,
  WarbandHero,
  WarbandHeroPayload,
  WarbandUpdatePayload,
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

export function createWarband(campaignId: number, payload: WarbandCreatePayload) {
  return apiRequest<Warband>("/warbands/", {
    method: "POST",
    body: {
      ...payload,
      campaign_id: campaignId,
    },
  });
}

export function updateWarband(warbandId: number, payload: WarbandUpdatePayload) {
  return apiRequest<Warband>(`/warbands/${warbandId}/`, {
    method: "PATCH",
    body: payload,
  });
}

export function listWarbandHeroes(warbandId: number) {
  return apiRequest<WarbandHero[]>(`/warbands/${warbandId}/heroes/`, {
  });
}

export function createWarbandHero(warbandId: number, payload: WarbandHeroPayload) {
  return apiRequest<WarbandHero>(`/warbands/${warbandId}/heroes/`, {
    method: "POST",
    body: payload,
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

export function deleteWarbandHero(warbandId: number, heroId: number) {
  return apiRequest<void>(`/warbands/${warbandId}/heroes/${heroId}/`, {
    method: "DELETE",
  });
}



