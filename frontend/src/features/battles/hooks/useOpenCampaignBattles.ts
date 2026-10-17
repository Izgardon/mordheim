import { useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

// api
import { listOpenCampaignBattles } from "../api/battles-api";

// other
import { isCampaignId } from "@/features/campaigns/hooks/useCampaignQuery";
import { queryKeys } from "@/lib/query-keys";

// types
import type { BattleState } from "../types/battle-types";

export const OPEN_BATTLES_STALE_TIME_MS = 30_000;

/** Window events (dispatched by the realtime handlers) that mean the caller's battles changed. */
const BATTLE_CHANGE_EVENTS = ["battle:invite", "battle:prebattle-opened", "battle:status-updated"];

/**
 * The caller's open battles in a campaign, shared by the layout (Rejoin Battle) and the overview's
 * battle panel. Refetches on focus and reconnect once stale.
 */
export function useOpenCampaignBattles(campaignId: number, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.campaign.openBattles(campaignId),
    queryFn: ({ signal }) => listOpenCampaignBattles(campaignId, { signal }),
    staleTime: OPEN_BATTLES_STALE_TIME_MS,
    enabled: enabled && isCampaignId(campaignId),
  });
}

/** Refetches the open battles when a realtime battle event arrives. Mount once per campaign. */
export function useOpenBattlesEventRefresh(campaignId: number) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isCampaignId(campaignId)) {
      return;
    }
    const invalidate = () =>
      void queryClient.invalidateQueries({ queryKey: queryKeys.campaign.openBattles(campaignId) });

    BATTLE_CHANGE_EVENTS.forEach((type) => window.addEventListener(type, invalidate));
    return () => {
      BATTLE_CHANGE_EVENTS.forEach((type) => window.removeEventListener(type, invalidate));
    };
  }, [campaignId, queryClient]);
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
    () => queryClient.invalidateQueries({ queryKey: queryKeys.campaign.openBattles(campaignId) }),
    [campaignId, queryClient]
  );
}
