import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { finalizeBattlePostbattle } from "@/features/battles/api/battles-api";
import { toPostbattleExplorationPayload } from "@/features/battles/components/postbattle/postbattle-utils";
import { useConfirmResults } from "@/features/battles/hooks/useConfirmResults";
import { useExploration } from "@/features/battles/hooks/useExploration";
import { useRefreshOpenBattles } from "@/features/battles/hooks/useOpenCampaignBattles";
import { usePostbattleDraft } from "@/features/battles/hooks/usePostbattleDraft";
import type { PostgameBattle } from "@/features/battles/hooks/usePostgameBattle";
import type { BattleParticipant, BattleState } from "@/features/battles/types/battle-types";
import { toastBattleWarnings } from "@/features/battles/utils/battle-warnings";
import { warbandSheetQuery } from "@/features/warbands/api/warband-queries";
import type { WarbandResource } from "@/features/warbands/types/warband-types";
import { getErrorMessage } from "@/lib/get-error-message";
import { useAppStore } from "@/stores/app-store";

const NO_RESOURCES: WarbandResource[] = [];

/**
 * The post-game draft of a loaded battle, as the Aftermath page and camp share it: the draft saved
 * as you go (the existing postbattle draft), the exploration roll, the results to confirm, the
 * warband's sheet, and Ready (finalise), which applies the draft to the warband.
 */
export function usePostgameDraft({
  campaignId,
  battleId,
  battle,
  battleState,
  participant,
}: {
  campaignId: number;
  battleId: number;
  battle: PostgameBattle;
  battleState: BattleState;
  participant: BattleParticipant;
}) {
  const queryClient = useQueryClient();
  const { clearCurrentBattleSession } = useAppStore();
  const refreshOpenBattles = useRefreshOpenBattles(campaignId);
  const warbandId = participant.warband.id;
  const sheet = useQuery(warbandSheetQuery(campaignId, warbandId));
  const resources = sheet.data?.summary.resources ?? NO_RESOURCES;
  const { applyBattleResponse, roster } = battle;
  const drafting = usePostbattleDraft({
    campaignId,
    battleId,
    battleState,
    currentParticipant: participant,
    currentRoster: roster,
    resources,
    applyBattleResponse,
  });
  const explore = useExploration({
    battleState,
    currentParticipant: participant,
    currentRoster: roster,
    resources,
    drafting,
  });
  const results = useConfirmResults({
    campaignId,
    battleId,
    battleState,
    capabilities: battle.capabilities,
    userId: battle.userId,
    applyBattleResponse,
  });
  const [isFinalizing, setIsFinalizing] = useState(false);
  const { draft, setDraftError } = drafting;
  const { exploration } = explore;

  /** Ready: applies the draft (XP, advances, injuries, shards, upkeep) and finishes your part. */
  const finalize = useCallback(async () => {
    if (!draft || !exploration) return false;
    setIsFinalizing(true);
    setDraftError("");
    try {
      const answer = await finalizeBattlePostbattle(campaignId, battleId, {
        postbattle_json: { ...draft, exploration: toPostbattleExplorationPayload(exploration) },
      });
      toastBattleWarnings(answer.warnings, (key) => draft.unit_results[key]?.unit_name);
      void queryClient.invalidateQueries({
        queryKey: ["campaign", campaignId, "warband", warbandId],
      });
      void queryClient.invalidateQueries({
        queryKey: warbandSheetQuery(campaignId, warbandId).queryKey,
      });
      clearCurrentBattleSession();
      void refreshOpenBattles();
      applyBattleResponse(answer);
      return true;
    } catch (error) {
      setDraftError(getErrorMessage(error, "Unable to finish the post-game"));
      return false;
    } finally {
      setIsFinalizing(false);
    }
  }, [
    applyBattleResponse,
    battleId,
    campaignId,
    clearCurrentBattleSession,
    draft,
    exploration,
    queryClient,
    refreshOpenBattles,
    setDraftError,
    warbandId,
  ]);

  return {
    sheet: sheet.data,
    resources,
    drafting,
    explore,
    results,
    finalize,
    isFinalizing,
    ready: Boolean(draft && exploration),
  };
}

export type PostgameDraft = ReturnType<typeof usePostgameDraft>;
