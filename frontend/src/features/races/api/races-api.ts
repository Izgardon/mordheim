import { apiRequest } from "../../../lib/api-client";
import { socketIdHeaders } from "@/lib/realtime/socket-headers";

import type { Race, RaceCreatePayload } from "../types/race-types";

type ListRacesOptions = {
  campaignId?: number;
  search?: string;
  signal?: AbortSignal;
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
  return apiRequest<Race[]>(path, { signal: options.signal });
}

export function createRace(payload: RaceCreatePayload) {
  return apiRequest<Race>("/races/", {
    method: "POST",
    headers: socketIdHeaders(),
    body: payload,
  });
}
