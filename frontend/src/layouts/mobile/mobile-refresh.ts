import type { QueryClient } from "@tanstack/react-query";

// other
import { queryKeys } from "@/lib/query-keys";

/** Last resort for pull-to-refresh, used only when refetching itself throws. */
export function reloadMobileLayout() {
  window.location.reload();
}

/**
 * Pull-to-refresh without reloading the app: invalidates everything campaign-scoped inside a
 * campaign (every query elsewhere), resolving once the queries on screen have refetched. Queries
 * that are not on screen refetch the next time they are used.
 */
export function refreshMobileQueries(queryClient: QueryClient, campaignId?: number) {
  const insideCampaign = campaignId !== undefined && Number.isFinite(campaignId);
  return queryClient.invalidateQueries(
    insideCampaign ? { queryKey: queryKeys.campaign.all(campaignId) } : {}
  );
}
