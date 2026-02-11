import { apiRequest } from "../../../lib/api-client";

import type { Special } from "../types/special-types";

type ListSpecialOptions = {
  type?: string;
  search?: string;
  campaignId?: number;
};

export type SpecialCreatePayload = {
  campaign_id: number;
  name: string;
  type: string;
  description: string;
};

export function listSpecial(options: ListSpecialOptions = {}) {
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
  const path = query ? `/special/?${query}` : "/special/";
  return apiRequest<Special[]>(path);
}

export function createSpecial(payload: SpecialCreatePayload) {
  return apiRequest<Special>("/special/", {
    method: "POST",
    body: payload,
  });
}

export function getSpecial(specialId: number) {
  return apiRequest<Special>(`/special/${specialId}/`);
}
