import { useQueryClient } from "@tanstack/react-query";

// api
import { cancelCampaignActiveBattle } from "../../api/campaigns-api";
import { updateCachedList, useCampaignActiveBattles } from "../../api/campaign-queries";
import {
  closePostbattle,
  confirmBattleResults,
  finishBattle,
} from "@/features/battles/api/battles-api";

// other
import { getErrorMessage } from "@/lib/get-error-message";
import { queryKeys } from "@/lib/query-keys";

// types
import type { CampaignActiveBattle } from "../../types/campaign-types";

const NO_BATTLES: CampaignActiveBattle[] = [];

type Results = { winners: number[]; losers: number[] };

/**
 * Settings → Active Battles (`manage_battles`, BATL-NEW-03): the cached list and a battle
 * manager's tools. Cancel and Close drop the row; End and Confirm move the battle on, and its
 * row's tools with it, so the list is read again.
 */
export function useActiveBattlesSection(campaignId: number) {
  const queryClient = useQueryClient();
  const query = useCampaignActiveBattles(campaignId);
  const queryKey = queryKeys.campaign.activeBattles(campaignId);
  const dropBattle = (battleId: number) =>
    updateCachedList<CampaignActiveBattle>(queryClient, queryKey, (prev) =>
      prev.filter((entry) => entry.battle.id !== battleId)
    );

  const onCancelBattle = async (battleId: number) => {
    const updated = await cancelCampaignActiveBattle(campaignId, battleId);
    dropBattle(updated.battle.id);
  };

  const onCloseBattle = async (battleId: number) => {
    await closePostbattle(campaignId, battleId);
    dropBattle(battleId);
  };

  const resultsWrite =
    (send: typeof finishBattle) => async (battleId: number, results: Results) => {
      await send(campaignId, battleId, results);
      await queryClient.invalidateQueries({ queryKey });
    };

  return {
    battles: query.data ?? NO_BATTLES,
    isLoading: query.isPending,
    error: query.error ? getErrorMessage(query.error, "Unable to load active battles") : "",
    onCancelBattle,
    onCloseBattle,
    onEndBattle: resultsWrite(finishBattle),
    onConfirmResults: resultsWrite(confirmBattleResults),
  };
}
