import { apiRequest } from "../../../lib/api-client";

import type {
  BestiaryEntry,
  BestiaryEntryCreatePayload,
  BestiaryEntrySummary,
  BestiaryEntryUpdatePayload,
  HiredSwordProfile,
  HiredSwordProfileCreatePayload,
  HiredSwordProfileSummary,
  HiredSwordProfileUpdatePayload,
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

// Hired Sword Profiles

type ListHiredSwordProfilesOptions = {
  search?: string;
  campaignId?: number;
};

export function listHiredSwordProfiles(
  options: ListHiredSwordProfilesOptions = {}
) {
  const params = new URLSearchParams();
  if (options.search) {
    params.set("search", options.search);
  }
  if (options.campaignId) {
    params.set("campaign_id", String(options.campaignId));
  }
  const query = params.toString();
  const path = query ? `/hired-swords/?${query}` : "/hired-swords/";
  return apiRequest<HiredSwordProfileSummary[]>(path);
}

export function getHiredSwordProfile(profileId: number) {
  return apiRequest<HiredSwordProfile>(`/hired-swords/${profileId}/`);
}

export function createHiredSwordProfile(
  payload: HiredSwordProfileCreatePayload
) {
  return apiRequest<HiredSwordProfile>("/hired-swords/", {
    method: "POST",
    body: payload,
  });
}

export function updateHiredSwordProfile(
  profileId: number,
  payload: HiredSwordProfileUpdatePayload
) {
  return apiRequest<HiredSwordProfile>(`/hired-swords/${profileId}/`, {
    method: "PATCH",
    body: payload,
  });
}

export function deleteHiredSwordProfile(profileId: number) {
  return apiRequest<void>(`/hired-swords/${profileId}/`, {
    method: "DELETE",
  });
}
