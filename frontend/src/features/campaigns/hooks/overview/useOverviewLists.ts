import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

// api
import {
  useCampaignBattleHistory,
  useCampaignPivotalMoments,
  useCampaignPlayers,
  useCompletedTrades,
} from "../../api/campaign-queries";

// other
import { getErrorMessage } from "@/lib/get-error-message";
import { queryKeys } from "@/lib/query-keys";

// types
import type {
  CampaignBattleHistoryEntry,
  CampaignPivotalMoment,
  CampaignPlayer,
} from "../../types/campaign-types";
import type { TradeRequest } from "@/features/warbands/types/trade-request-types";

const NO_PLAYERS: CampaignPlayer[] = [];
const NO_TRADES: TradeRequest[] = [];
const NO_BATTLES: CampaignBattleHistoryEntry[] = [];
const NO_MOMENTS: CampaignPivotalMoment[] = [];

const errorText = (error: unknown, fallback: string) =>
  error ? getErrorMessage(error, fallback) : "";

/** The overview tab's four lists: the roster, completed trades, battle history and moments. */
export function useOverviewLists(campaignId: number) {
  const queryClient = useQueryClient();
  const players = useCampaignPlayers(campaignId);
  const trades = useCompletedTrades(campaignId);
  const history = useCampaignBattleHistory(campaignId);
  const moments = useCampaignPivotalMoments(campaignId);

  // A battle manager edited a record (BATL-NEW-04): read the history again.
  const reloadBattleHistory = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.campaign.battleHistory(campaignId) });
  }, [campaignId, queryClient]);

  return {
    players: players.data ?? NO_PLAYERS,
    isLoading: players.isPending,
    error: errorText(players.error, "Unable to load players"),
    tradeRequests: trades.data ?? NO_TRADES,
    isTradesLoading: trades.isPending,
    tradeError: errorText(trades.error, "Unable to load trades"),
    battleHistory: history.data ?? NO_BATTLES,
    isBattleHistoryLoading: history.isPending,
    battleHistoryError: errorText(history.error, "Unable to load battle history"),
    reloadBattleHistory,
    pivotalMoments: moments.data ?? NO_MOMENTS,
    isPivotalMomentsLoading: moments.isPending,
    pivotalMomentsError: errorText(moments.error, "Unable to load pivotal moments"),
  };
}
