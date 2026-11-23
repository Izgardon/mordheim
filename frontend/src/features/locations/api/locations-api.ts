import { apiRequest } from "@/lib/api-client";
import { socketIdHeaders } from "@/lib/realtime/socket-headers";

import type {
  CampaignLocation,
  LocationGroup,
  LocationGroupPayload,
  LocationPayload,
  VisitAnswer,
} from "../types";

const base = (campaignId: number) => `/campaigns/${campaignId}`;

/** Every group in its order, each with its locations, their tables and links. */
export function listLocationGroups(campaignId: number) {
  return apiRequest<LocationGroup[]>(`${base(campaignId)}/location-groups/`);
}

export function createLocationGroup(campaignId: number, payload: LocationGroupPayload) {
  return apiRequest<LocationGroup>(`${base(campaignId)}/location-groups/`, {
    method: "POST",
    body: payload,
  });
}

export function updateLocationGroup(
  campaignId: number,
  groupId: number,
  payload: LocationGroupPayload
) {
  return apiRequest<LocationGroup>(`${base(campaignId)}/location-groups/${groupId}/`, {
    method: "PATCH",
    body: payload,
  });
}

/** Takes the group and its locations off the list for everyone (a soft delete). */
export function deleteLocationGroup(campaignId: number, groupId: number) {
  return apiRequest<void>(`${base(campaignId)}/location-groups/${groupId}/`, { method: "DELETE" });
}

export function createLocation(campaignId: number, payload: LocationPayload) {
  return apiRequest<CampaignLocation>(`${base(campaignId)}/locations/`, {
    method: "POST",
    body: payload,
  });
}

export function updateLocation(campaignId: number, locationId: number, payload: LocationPayload) {
  return apiRequest<CampaignLocation>(`${base(campaignId)}/locations/${locationId}/`, {
    method: "PATCH",
    body: payload,
  });
}

export function deleteLocation(campaignId: number, locationId: number) {
  return apiRequest<void>(`${base(campaignId)}/locations/${locationId}/`, { method: "DELETE" });
}

/** Heroes go: the server spends the trading actions the location takes and logs who went. */
export function visitLocation(warbandId: number, locationId: number, heroIds: number[]) {
  return apiRequest<VisitAnswer>(`/warbands/${warbandId}/location-visits/`, {
    method: "POST",
    headers: socketIdHeaders(),
    body: { location_id: locationId, hero_ids: heroIds },
  });
}
