import { useCallback } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

// api
import { listOpenCampaignBattles } from "../api/battles-api";

// other
import { isCampaignId } from "@/features/campaigns/hooks/useCampaignQuery";
import { queryKeys } from "@/lib/query-keys";

// types
import type { BattleState } from "../types/battle-types";

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
 * Marks a campaign's open battles stale after a battle changed (a realtime event or the caller's
 * own action); screens showing them refetch. Replaces the old window "battle:*" event bus.
 */
export function invalidateOpenBattles(queryClient: QueryClient, campaignId: number) {
  if (!isCampaignId(campaignId)) {
    return Promise.resolve();
  }
  return queryClient.invalidateQueries({ queryKey: queryKeys.campaign.openBattles(campaignId) });
}

/** Writes a battle returned by a join/cancel call into the cached open battles. */
export function useReplaceOpenBattle(campaignId: number) {
  const queryClient = useQueryClient();
  return useCallback(
    (updated: BattleState) => {
      queryClient.setQueryData(
        queryKeys.campaign.openBattles(campaignId),
        (previous: BattleState[] | undefined) =>
          previous?.map((entry) => (entry.battle.id === updated.battle.id ? updated : entry))
      );
    },
    [campaignId, queryClient]
  );
}

/** Refetches the open battles now, e.g. after the caller starts a battle. */
export function useRefreshOpenBattles(campaignId: number) {
  const queryClient = useQueryClient();
  return useCallback(
    () => invalidateOpenBattles(queryClient, campaignId),
    [campaignId, queryClient]
  );
}
