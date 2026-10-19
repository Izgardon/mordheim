import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import {
  confirmBattlePostbattle,
  finalizeBattlePostbattle,
} from "@/features/battles/api/battles-api";
import {
  toPostbattleExplorationPayload,
  type LocalExplorationState,
} from "@/features/battles/components/postbattle/postbattle-utils";
import { useClosePostbattle } from "@/features/battles/hooks/useClosePostbattle";
import { useRefreshOpenBattles } from "@/features/battles/hooks/useOpenCampaignBattles";
import type { PostbattleDraft } from "@/features/battles/hooks/usePostbattleDraft";
import type {
  BattleCapabilities,
  BattleParticipant,
  BattleState,
} from "@/features/battles/types/battle-types";
import { toastBattleOver } from "@/features/battles/utils/battle-over";
import { toastBattleWarnings } from "@/features/battles/utils/battle-warnings";
import { getErrorMessage } from "@/lib/get-error-message";
import { queryKeys } from "@/lib/query-keys";
import { useAppStore } from "@/stores/app-store";

/**
 * The ways out of postbattle: Finalise (applies the draft) and Skip postbattle (applies nothing),
 * after which the page waits for the others (BATL-NEW-08); Close postbattle for the creator or a
 * battle manager (BUG-09); and the back chevron, which only leaves the page (BUG-48). Skip and
 * Close sit in More actions.
 */
export function usePostbattleExit({
  campaignId,
  battleId,
  battleState,
  currentParticipant,
  canManageBattles,
  capabilities,
  userId,
  exploration,
  drafting,
  applyBattleResponse,
}: {
  campaignId: number;
  battleId: number;
  battleState: BattleState;
  currentParticipant: BattleParticipant | null;
  canManageBattles: boolean;
  capabilities: BattleCapabilities | null;
  userId: number | undefined;
  exploration: LocalExplorationState | null;
  drafting: PostbattleDraft;
  applyBattleResponse: (next: BattleState) => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { clearCurrentBattleSession } = useAppStore();
  const refreshOpenBattles = useRefreshOpenBattles(campaignId);
  const { draft, setDraftError, isSavingDraft } = drafting;
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const [isFinalizeOpen, setIsFinalizeOpen] = useState(false);
  const [isSkipConfirmOpen, setIsSkipConfirmOpen] = useState(false);
  const isFinalized = currentParticipant?.status === "confirmed_postbattle";
  const warbandId = currentParticipant?.warband.id ?? null;

  // Finalising or skipping is your part done (BATL-NEW-08): the page shows "Waiting for others"
  // until the battle ends. The last player to finish ends it and goes to his warband.
  const finishPostbattle = useCallback(
    (answer: BattleState) => {
      clearCurrentBattleSession();
      void refreshOpenBattles();
      if (answer.battle.status === "ended") {
        toastBattleOver(answer, userId);
        navigate(`/campaigns/${campaignId}/warband`, { replace: true });
        return;
      }
      applyBattleResponse(answer);
    },
    [
      applyBattleResponse,
      campaignId,
      clearCurrentBattleSession,
      navigate,
      refreshOpenBattles,
      userId,
    ]
  );

  const finalize = useCallback(async () => {
    if (!draft || !currentParticipant || !exploration) return;
    setIsFinalizing(true);
    setDraftError("");
    try {
      const finalised = await finalizeBattlePostbattle(campaignId, battleId, {
        postbattle_json: { ...draft, exploration: toPostbattleExplorationPayload(exploration) },
      });
      toastBattleWarnings(finalised.warnings);
      if (warbandId !== null) {
        // Finalising changed the warband (XP, gold, items): its pages read it afresh.
        void queryClient.invalidateQueries({
          queryKey: queryKeys.campaign.warband(campaignId, warbandId),
        });
      }
      setIsFinalizeOpen(false);
      finishPostbattle(finalised);
    } catch (errorResponse) {
      setDraftError(getErrorMessage(errorResponse, "Unable to finalise postbattle"));
    } finally {
      setIsFinalizing(false);
    }
  }, [
    battleId,
    campaignId,
    currentParticipant,
    draft,
    finishPostbattle,
    exploration,
    queryClient,
    setDraftError,
    warbandId,
  ]);

  const skip = useCallback(async () => {
    if (!currentParticipant) return;
    setIsSkipping(true);
    setDraftError("");
    try {
      const skipped = await confirmBattlePostbattle(campaignId, battleId);
      setIsSkipConfirmOpen(false);
      finishPostbattle(skipped);
    } catch (errorResponse) {
      setDraftError(getErrorMessage(errorResponse, "Unable to skip postbattle"));
    } finally {
      setIsSkipping(false);
    }
  }, [battleId, campaignId, currentParticipant, finishPostbattle, setDraftError]);

  // The back chevron only leaves the page: the draft is saved and the overview resumes it (BUG-48).
  const back = useCallback(() => {
    navigate(`/campaigns/${campaignId}`);
  }, [campaignId, navigate]);
  const openWarband = useCallback(() => {
    navigate(`/campaigns/${campaignId}/warband`);
  }, [campaignId, navigate]);

  // Close postbattle replaces Cancel here (BUG-09): the creator's, or a battle manager's, as the
  // server's capabilities say (without them, those two rules).
  const canClosePostbattle = capabilities
    ? capabilities.close_postbattle
    : battleState.battle.created_by_user_id === userId || canManageBattles;
  const closing = useClosePostbattle({
    campaignId,
    battleId,
    onClosed: useCallback(
      (next: BattleState) => {
        clearCurrentBattleSession();
        void refreshOpenBattles();
        applyBattleResponse(next);
      },
      [applyBattleResponse, clearCurrentBattleSession, refreshOpenBattles]
    ),
  });
  const openCloseConfirm = closing.openChange;
  const overflowActions = useMemo(
    () => [
      {
        label: "Skip postbattle",
        onSelect: () => setIsSkipConfirmOpen(true),
        disabled: isFinalized || isFinalizing || isSkipping || isSavingDraft,
        destructive: true,
      },
      ...(canClosePostbattle
        ? [
            {
              label: "Close postbattle",
              onSelect: () => openCloseConfirm(true),
              disabled: isFinalizing || isSkipping,
              destructive: true,
            },
          ]
        : []),
    ],
    [canClosePostbattle, isFinalized, isFinalizing, isSavingDraft, isSkipping, openCloseConfirm]
  );

  return {
    isFinalized,
    isFinalizing,
    isSkipping,
    finalizeDialog: { isOpen: isFinalizeOpen, setIsOpen: setIsFinalizeOpen },
    skipDialog: { isOpen: isSkipConfirmOpen, setIsOpen: setIsSkipConfirmOpen },
    finalize,
    skip,
    back,
    openWarband,
    closing,
    overflowActions,
  };
}

export type PostbattleExit = ReturnType<typeof usePostbattleExit>;
