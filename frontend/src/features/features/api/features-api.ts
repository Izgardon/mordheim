import { apiRequest } from "../../../lib/api-client";

import type { Feature } from "../types/feature-types";

type ListFeaturesOptions = {
  type?: string;
  search?: string;
  campaignId?: number;
};

export type FeatureCreatePayload = {
  campaign_id: number;
  name: string;
  type: string;
  description: string;
};

export function listFeatures(options: ListFeaturesOptions = {}) {
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
  const path = query ? `/features/?${query}` : "/features/";
  return apiRequest<Feature[]>(path);
}

export function createFeature(payload: FeatureCreatePayload) {
  return apiRequest<Feature>("/features/", {
    method: "POST",
    body: payload,
  });
}

export function getFeature(featureId: number) {
  return apiRequest<Feature>(`/features/${featureId}/`);
}
