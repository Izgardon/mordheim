import { apiRequest } from "@/lib/api-client";

import type { HirelingCatalogueKind } from "../hireling-catalogue-kinds";
import type {
  HirelingProfile,
  HirelingProfileDetail,
  HirelingProfileWrite,
} from "../types/hireling-catalogue-types";

type ListOptions = {
  campaignId: number;
  /** Archived entries and book entries removed for the campaign too (`?archived=1`). */
  archived?: boolean;
  signal?: AbortSignal;
};

/** `GET hired-swords/?campaign_id=` (or `dramatis-personae/`): the campaign's list of the kind. */
export function listHirelingProfiles(kind: HirelingCatalogueKind, options: ListOptions) {
  const params = new URLSearchParams({ campaign_id: String(options.campaignId) });
  if (options.archived) {
    params.set("archived", "1");
  }
  return apiRequest<HirelingProfile[]>(`/${kind}/?${params}`, { signal: options.signal });
}

/** One entry with its skills, specials, spells and equipment. */
export function getHirelingProfile(kind: HirelingCatalogueKind, id: number, signal?: AbortSignal) {
  return apiRequest<HirelingProfileDetail>(`/${kind}/${id}/`, { signal });
}

export function createHirelingProfile(kind: HirelingCatalogueKind, payload: HirelingProfileWrite) {
  return apiRequest<HirelingProfileDetail>(`/${kind}/`, { method: "POST", body: payload });
}

export function updateHirelingProfile(
  kind: HirelingCatalogueKind,
  id: number,
  payload: HirelingProfileWrite
) {
  return apiRequest<HirelingProfileDetail>(`/${kind}/${id}/`, { method: "PATCH", body: payload });
}
