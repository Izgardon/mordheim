import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

// api
import { listOpenCampaignBattles } from "../api/battles-api";

// other
import { isCampaignId } from "@/features/campaigns/hooks/useCampaignQuery";
import { queryKeys } from "@/lib/query-keys";
import { yourOpenBattles } from "../utils/open-battles";

export const OPEN_BATTLES_STALE_TIME_MS = 30_000;

/**
 * The caller's open battles in a campaign, shared by the layout (Rejoin Battle) and the overview's
 * battle panel. Refetches on focus and reconnect once stale, and when a battle event marks it stale.
 */
export function useOpenCampaignBattles(campaignId: number, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.campaign.openBattles(campaignId),
    queryFn: ({ signal }) => listOpenCampaignBattles(campaignId, { signal }),
    staleTime: OPEN_BATTLES_STALE_TIME_MS,
    enabled: enabled && isCampaignId(campaignId),
  });
}

/**
 * Your unfinished battles in the campaign, the one that needs you most first (`yourOpenBattles`),
 * from the same query: the rejoin banner, the rail's Rejoin, the phone's Battle, the overview's
 * and the Battles page's button all pick the same battle. `loaded` once the list has come in.
 */
export function useYourOpenBattles(campaignId: number, { enabled = true } = {}) {
  const { data } = useOpenCampaignBattles(campaignId, { enabled });
  const battles = useMemo(() => yourOpenBattles(data ?? []), [data]);
  return { battles, loaded: data !== undefined };
}

/**
 * Marks a campaign's open battles stale after a battle changed (a realtime event or the caller's
 * own action); screens showing them refetch. Replaces the old window "battle:*" event bus.
 */
export function invalidateOpenBattles(queryClient: QueryClient, campaignId: number) {
  if (!isCampaignId(campaignId)) {
    return Promise.resolve();
  }
  return queryClient.invalidateQueries({ queryKey: queryKeys.campaign.openBattles(campaignId) });
}

/** Refetches the open battles now, e.g. after the caller starts a battle. */
export function useRefreshOpenBattles(campaignId: number) {
  const queryClient = useQueryClient();
  return useCallback(
    () => invalidateOpenBattles(queryClient, campaignId),
    [campaignId, queryClient]
  );
}
