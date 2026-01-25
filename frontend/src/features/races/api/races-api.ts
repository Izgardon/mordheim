import { apiRequest } from "../../../lib/api-client";

import type { Race, RaceCreatePayload } from "../types/race-types";

type ListRacesOptions = {
  campaignId?: number;
  search?: string;
};

export function listRaces(options: ListRacesOptions = {}) {
  const params = new URLSearchParams();
  if (options.campaignId) {
    params.set("campaign_id", String(options.campaignId));
  }
  if (options.search) {
    params.set("search", options.search);
  }
  const query = params.toString();
  const path = query ? `/races/?${query}` : "/races/";
  return apiRequest<Race[]>(path);
}

export function createRace(payload: RaceCreatePayload) {
  return apiRequest<Race>("/races/", {
    method: "POST",
    body: payload,
  });
}
