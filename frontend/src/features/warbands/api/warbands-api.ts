import { apiRequest } from "../../../lib/api-client";
import type {
  Warband,
  WarbandCreatePayload,
  WarbandHero,
  WarbandHeroPayload,
  WarbandUpdatePayload,
} from "../types/warband-types";

export async function getWarband(token: string, campaignId: number) {
  const data = await apiRequest<Warband[]>(
    `/warbands/?campaign_id=${encodeURIComponent(campaignId)}`,
    { token }
  );
  return data[0] ?? null;
}

export function createWarband(
  token: string,
  campaignId: number,
  payload: WarbandCreatePayload
) {
  return apiRequest<Warband>("/warbands/", {
    method: "POST",
    body: {
      ...payload,
      campaign_id: campaignId,
    },
    token,
  });
}

export function updateWarband(
  token: string,
  warbandId: number,
  payload: WarbandUpdatePayload
) {
  return apiRequest<Warband>(`/warbands/${warbandId}/`, {
    method: "PATCH",
    body: payload,
    token,
  });
}

export function listWarbandHeroes(token: string, warbandId: number) {
  return apiRequest<WarbandHero[]>(`/warbands/${warbandId}/heroes/`, {
    token,
  });
}

export function createWarbandHero(
  token: string,
  warbandId: number,
  payload: WarbandHeroPayload
) {
  return apiRequest<WarbandHero>(`/warbands/${warbandId}/heroes/`, {
    method: "POST",
    body: payload,
    token,
  });
}

export function updateWarbandHero(
  token: string,
  warbandId: number,
  heroId: number,
  payload: WarbandHeroPayload
) {
  return apiRequest<WarbandHero>(`/warbands/${warbandId}/heroes/${heroId}/`, {
    method: "PATCH",
    body: payload,
    token,
  });
}

export function deleteWarbandHero(token: string, warbandId: number, heroId: number) {
  return apiRequest<void>(`/warbands/${warbandId}/heroes/${heroId}/`, {
    method: "DELETE",
    token,
  });
}
