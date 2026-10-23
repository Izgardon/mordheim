import { apiRequest } from "../../../lib/api-client";

import type {
  BestiaryEntry,
  BestiaryEntrySummary,
  BestiaryEntryWrite,
} from "../types/bestiary-types";

type ListBestiaryOptions = {
  campaignId: number;
  /** Archived entries and book entries removed for the campaign too (`?archived=1`). */
  archived?: boolean;
  signal?: AbortSignal;
};

/**
 * `GET bestiary/?campaign_id=`: every beast the campaign has, of every kind, with its item's
 * prices. The pages filter by kind themselves, so one cached list serves them all.
 */
export function listBestiaryEntries(options: ListBestiaryOptions) {
  const params = new URLSearchParams({ campaign_id: String(options.campaignId) });
  if (options.archived) {
    params.set("archived", "1");
  }
  return apiRequest<BestiaryEntrySummary[]>(`/bestiary/?${params}`, { signal: options.signal });
}

/** One beast with its skills, specials, spells and equipment. */
export function getBestiaryEntry(entryId: number, signal?: AbortSignal) {
  return apiRequest<BestiaryEntry>(`/bestiary/${entryId}/`, { signal });
}

export function createBestiaryEntry(payload: BestiaryEntryWrite) {
  return apiRequest<BestiaryEntry>("/bestiary/", {
    method: "POST",
    body: payload,
  });
}

export function updateBestiaryEntry(entryId: number, payload: BestiaryEntryWrite) {
  return apiRequest<BestiaryEntry>(`/bestiary/${entryId}/`, {
    method: "PATCH",
    body: payload,
  });
}

export function listWarbandBestiaryFavourites(warbandId: number) {
  return apiRequest<BestiaryEntrySummary[]>(`/warbands/${warbandId}/bestiary-favourites/`);
}

export function addWarbandBestiaryFavourite(warbandId: number, bestiaryEntryId: number) {
  return apiRequest<void>(`/warbands/${warbandId}/bestiary-favourites/`, {
    method: "POST",
    body: { bestiary_entry_id: bestiaryEntryId },
  });
}

export function removeWarbandBestiaryFavourite(warbandId: number, bestiaryEntryId: number) {
  return apiRequest<void>(`/warbands/${warbandId}/bestiary-favourites/${bestiaryEntryId}/`, {
    method: "DELETE",
  });
}
