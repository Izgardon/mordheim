import { apiRequest } from "../../../lib/api-client";

import type {
  BestiaryEntry,
  BestiaryEntryCreatePayload,
  BestiaryEntrySummary,
  BestiaryEntryUpdatePayload,
} from "../types/bestiary-types";

type ListBestiaryOptions = {
  type?: string;
  search?: string;
  campaignId?: number;
};

export function listBestiaryEntries(options: ListBestiaryOptions = {}) {
  const params = new URLSearchParams();
  if (options.type) {
    params.set("type", options.type);
  }
  if (options.search) {
    params.set("search", options.search);
  }
  if (options.campaignId) {
    params.set("campaign_id", String(options.campaignId));
  }
  const query = params.toString();
  const path = query ? `/bestiary/?${query}` : "/bestiary/";
  return apiRequest<BestiaryEntrySummary[]>(path);
}

export function getBestiaryEntry(entryId: number) {
  return apiRequest<BestiaryEntry>(`/bestiary/${entryId}/`);
}

export function createBestiaryEntry(payload: BestiaryEntryCreatePayload) {
  return apiRequest<BestiaryEntry>("/bestiary/", {
    method: "POST",
    body: payload,
  });
}

export function updateBestiaryEntry(
  entryId: number,
  payload: BestiaryEntryUpdatePayload
) {
  return apiRequest<BestiaryEntry>(`/bestiary/${entryId}/`, {
    method: "PATCH",
    body: payload,
  });
}

export function deleteBestiaryEntry(entryId: number) {
  return apiRequest<void>(`/bestiary/${entryId}/`, {
    method: "DELETE",
  });
}

export function listWarbandBestiaryFavourites(warbandId: number) {
  return apiRequest<BestiaryEntrySummary[]>(
    `/warbands/${warbandId}/bestiary-favourites/`
  );
}

export function addWarbandBestiaryFavourite(
  warbandId: number,
  bestiaryEntryId: number
) {
  return apiRequest<void>(`/warbands/${warbandId}/bestiary-favourites/`, {
    method: "POST",
    body: { bestiary_entry_id: bestiaryEntryId },
  });
}

export function removeWarbandBestiaryFavourite(
  warbandId: number,
  bestiaryEntryId: number
) {
  return apiRequest<void>(
    `/warbands/${warbandId}/bestiary-favourites/${bestiaryEntryId}/`,
    { method: "DELETE" }
  );
}
