import { useQuery, type QueryClient } from "@tanstack/react-query";

import { listCampaigns } from "../api/campaigns-api";
import { queryKeys } from "@/lib/query-keys";

import type { CampaignSummary } from "../types/campaign-types";

/**
 * Your campaigns, as the campaigns page lists them: read on every visit, as the page always was,
 * with the last list shown meanwhile. One you leave, are removed from or that is deleted for good
 * drops out at once (`dropFromCampaignList`).
 */
export function useCampaignList() {
  return useQuery({
    queryKey: queryKeys.campaigns(),
    queryFn: () => listCampaigns(),
    staleTime: 0,
  });
}

/** A campaign you created or joined goes to the top of the list. */
export function addToCampaignList(queryClient: QueryClient, campaign: CampaignSummary) {
  queryClient.setQueryData<CampaignSummary[]>(
    queryKeys.campaigns(),
    (prev: CampaignSummary[] | undefined) => (prev ? [campaign, ...prev] : prev)
  );
}

/** A campaign you are no longer in, or that is gone, leaves the list. */
export function dropFromCampaignList(queryClient: QueryClient, campaignId: number) {
  queryClient.setQueryData<CampaignSummary[]>(
    queryKeys.campaigns(),
    (prev: CampaignSummary[] | undefined) =>
      prev?.filter((campaign: CampaignSummary) => campaign.id !== campaignId)
  );
}
