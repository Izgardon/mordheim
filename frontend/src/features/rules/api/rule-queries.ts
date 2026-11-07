import { useQuery } from "@tanstack/react-query";

// api
import { listCampaignRules } from "./campaign-rules-api";
import { listCommonRules, listHouseRules } from "./rules-api";

// other
import { CAMPAIGN_LIST_STALE_TIME_MS } from "@/features/campaigns/api/campaign-queries";
import { isCampaignId } from "@/features/campaigns/hooks/useCampaignQuery";
import { queryKeys } from "@/lib/query-keys";

/** The campaign's house rules, cached under the campaign (IMP-66). */
export function useHouseRules(campaignId: number) {
  return useQuery({
    queryKey: queryKeys.campaign.houseRules(campaignId),
    queryFn: () => listHouseRules(campaignId),
    staleTime: CAMPAIGN_LIST_STALE_TIME_MS,
    enabled: isCampaignId(campaignId),
  });
}

/** The campaign's own rules in their order, cached under the campaign as its house rules are. */
export function useCampaignRules(campaignId: number) {
  return useQuery({
    queryKey: queryKeys.campaign.campaignRules(campaignId),
    queryFn: () => listCampaignRules(campaignId),
    staleTime: CAMPAIGN_LIST_STALE_TIME_MS,
    enabled: isCampaignId(campaignId),
  });
}

/**
 * The server's common house rules (`rules/common/`, IMP-69): the same list for every campaign,
 * changing only with a deploy, so it is read once per session.
 */
export function useCommonRules(campaignId: number) {
  return useQuery({
    queryKey: queryKeys.campaign.commonRules(campaignId),
    queryFn: () => listCommonRules(campaignId),
    staleTime: Infinity,
    enabled: isCampaignId(campaignId),
  });
}
