import { useQuery, type QueryClient } from "@tanstack/react-query";

// api
import { listPendingReportedResults } from "../api/battles-api";

// other
import { isCampaignId } from "@/features/campaigns/hooks/useCampaignQuery";
import { queryKeys } from "@/lib/query-keys";

/**
 * Your reported results in a campaign still waiting for answers, for the overview's card
 * (BUG-46). Refetched when a result request or answer arrives, and after you answer one.
 */
export function usePendingReportedResults(campaignId: number, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.campaign.pendingResults(campaignId),
    queryFn: ({ signal }) => listPendingReportedResults(campaignId, { signal }),
    staleTime: 30_000,
    enabled: enabled && isCampaignId(campaignId),
  });
}

/** Marks a campaign's pending results stale after one was reported, answered or withdrawn. */
export function invalidatePendingResults(queryClient: QueryClient, campaignId: number) {
  if (!isCampaignId(campaignId)) {
    return Promise.resolve();
  }
  return queryClient.invalidateQueries({ queryKey: queryKeys.campaign.pendingResults(campaignId) });
}
