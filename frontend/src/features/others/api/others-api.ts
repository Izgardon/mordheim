import { apiRequest } from "../../../lib/api-client";

import type { Other } from "../types/other-types";

type ListOthersOptions = {
  type?: string;
  search?: string;
  campaignId?: number;
};

export type OtherCreatePayload = {
  campaign_id: number;
  name: string;
  type: string;
  description: string;
};

export function listOthers(options: ListOthersOptions = {}) {
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
  const path = query ? `/others/?${query}` : "/others/";
  return apiRequest<Other[]>(path);
}

export function createOther(payload: OtherCreatePayload) {
  return apiRequest<Other>("/others/", {
    method: "POST",
    body: payload,
  });
}
