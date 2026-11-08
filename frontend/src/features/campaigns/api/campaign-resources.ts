import { useQuery } from "@tanstack/react-query";

import { apiRequest } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

/**
 * One of the campaign's resources (`GET campaigns/<id>/resources/`): a name its warbands' counters
 * hold, its default resource first (named as its settings name it), then campaign points while
 * they are on, then the rest by name. Gold is never one.
 */
export type CampaignResource = { name: string; is_default: boolean; is_campaign_points: boolean };

/** A resource someone just added or deleted shows the next time a fee form opens. */
const RESOURCES_STALE_TIME_MS = 30_000;

export function listCampaignResources(campaignId: number) {
  return apiRequest<CampaignResource[]>(`/campaigns/${campaignId}/resources/`);
}

/**
 * The resources a fee may name (William, 7 Nov 2026: "resource options should be options from
 * the campaigns resources that still exist"), read while a fee form is open.
 */
export function useCampaignResources(campaignId: number, enabled = true) {
  return useQuery({
    queryKey: queryKeys.campaign.resources(campaignId),
    queryFn: () => listCampaignResources(campaignId),
    staleTime: RESOURCES_STALE_TIME_MS,
    enabled: enabled && campaignId > 0,
  });
}
