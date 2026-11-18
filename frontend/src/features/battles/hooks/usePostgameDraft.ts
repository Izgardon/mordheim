import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { applyAftermathStep, finalizeBattlePostbattle } from "@/features/battles/api/battles-api";
import { aftermathLocks } from "@/features/battles/components/aftermath/aftermath-locks";
import { toPostbattleExplorationPayload } from "@/features/battles/components/postbattle/postbattle-utils";
import { useConfirmResults } from "@/features/battles/hooks/useConfirmResults";
import { useExploration } from "@/features/battles/hooks/useExploration";
import { useRefreshOpenBattles } from "@/features/battles/hooks/useOpenCampaignBattles";
import { usePostbattleDraft } from "@/features/battles/hooks/usePostbattleDraft";
import type { PostgameBattle } from "@/features/battles/hooks/usePostgameBattle";
import type {
  AftermathStep,
  BattleParticipant,
  BattleState,
} from "@/features/battles/types/battle-types";
import { toastBattleWarnings } from "@/features/battles/utils/battle-warnings";
import { warbandSheetQuery } from "@/features/warbands/api/warband-queries";
import type { WarbandResource } from "@/features/warbands/types/warband-types";
import { getErrorMessage } from "@/lib/get-error-message";
import { useAppStore } from "@/stores/app-store";

const NO_RESOURCES: WarbandResource[] = [];

/**
 * The post-game draft of a loaded battle, as the Aftermath page and camp share it: the draft saved
 * as you go (the existing postbattle draft), the exploration roll, the results to confirm, the
 * warband's sheet, `applyStep` (the aftermath's Next, which hands that step's results to the
 * warband there and then) and Ready, which applies whatever is left of it and charges upkeep.
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
  const [applyingStep, setApplyingStep] = useState<AftermathStep | null>(null);
  const { draft, setDraftError } = drafting;
  const { exploration } = explore;

  /** The answer of a write that changed the warband: its warnings, and the pages that read it. */
  const applied = useCallback(
    (answer: BattleState) => {
      toastBattleWarnings(answer.warnings, (key) => draft?.unit_results[key]?.unit_name);
      void queryClient.invalidateQueries({
        queryKey: ["campaign", campaignId, "warband", warbandId],
      });
      void queryClient.invalidateQueries({
        queryKey: warbandSheetQuery(campaignId, warbandId).queryKey,
      });
      applyBattleResponse(answer);
    },
    [applyBattleResponse, campaignId, draft, queryClient, warbandId]
  );

  const sent = useCallback(
    () => ({
      postbattle_json: { ...draft!, exploration: toPostbattleExplorationPayload(exploration!) },
    }),
    [draft, exploration]
  );

  /** Next: the step he is leaving goes to the warband now (William, 18 Nov 2026). */
  const applyStep = useCallback(
    async (step: AftermathStep) => {
      if (!draft || !exploration) return false;
      setApplyingStep(step);
      setDraftError("");
      try {
        applied(await applyAftermathStep(campaignId, battleId, step, sent()));
        return true;
      } catch (error) {
        setDraftError(getErrorMessage(error, "Unable to apply this step"));
        return false;
      } finally {
        setApplyingStep(null);
      }
    },
    [applied, battleId, campaignId, draft, exploration, sent, setDraftError]
  );

  /** Ready: applies what is left of the aftermath, charges upkeep and finishes your part. */
  const finalize = useCallback(async () => {
    if (!draft || !exploration) return false;
    setIsFinalizing(true);
    setDraftError("");
    try {
      const answer = await finalizeBattlePostbattle(campaignId, battleId, sent());
      applied(answer);
      clearCurrentBattleSession();
      void refreshOpenBattles();
      return true;
    } catch (error) {
      setDraftError(getErrorMessage(error, "Unable to finish the post-game"));
      return false;
    } finally {
      setIsFinalizing(false);
    }
  }, [
    applied,
    battleId,
    campaignId,
    clearCurrentBattleSession,
    draft,
    exploration,
    refreshOpenBattles,
    sent,
    setDraftError,
  ]);

  return {
    sheet: sheet.data,
    resources,
    drafting,
    explore,
    results,
    applyStep,
    applyingStep,
    /** What the aftermath has already handed over to the warband (the server's record). */
    locks: aftermathLocks(draft),
    finalize,
    isFinalizing,
    ready: Boolean(draft && exploration),
  };
}

export type PostgameDraft = ReturnType<typeof usePostgameDraft>;
