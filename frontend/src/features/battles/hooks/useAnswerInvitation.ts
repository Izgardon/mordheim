import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { declineBattleInvite, joinBattle } from "@/features/battles/api/battles-api";
import { getErrorMessage } from "@/lib/get-error-message";
import { useAppStore } from "@/stores/app-store";

import { invalidateOpenBattles } from "./useOpenCampaignBattles";

export type InvitationAnswer = "accept" | "decline";

/**
 * Accepting or declining a battle invitation from a list of your battles (the Battles page's
 * "Your open battles"), as the bell's card does: the invite leaves the bell, your open battles
 * are read again, and an accepted battle whose pre-battle is open goes there. Declining is final.
 */
export function useAnswerInvitation(campaignId: number) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentBattleSession, clearCurrentBattleSession, removeBattleInviteNotification } =
    useAppStore();
  const [busy, setBusy] = useState<number | null>(null);
  const [failure, setFailure] = useState<{ battleId: number; message: string } | null>(null);

  const answer = useCallback(
    async (battleId: number, choice: InvitationAnswer) => {
      setBusy(battleId);
      setFailure(null);
      try {
        const next =
          choice === "accept"
            ? await joinBattle(campaignId, battleId)
            : await declineBattleInvite(campaignId, battleId);
        removeBattleInviteNotification(`battle-${battleId}`);
        if (choice === "decline" && currentBattleSession?.battleId === battleId) {
          clearCurrentBattleSession();
        }
        void invalidateOpenBattles(queryClient, campaignId);
        if (choice === "accept" && next.battle.status === "prebattle") {
          navigate(`/campaigns/${campaignId}/battles/${battleId}/prebattle`);
        }
      } catch (error) {
        const fallback =
          choice === "accept" ? "Unable to accept invitation" : "Unable to decline the invitation";
        setFailure({ battleId, message: getErrorMessage(error, fallback) });
      } finally {
        setBusy(null);
      }
    },
    [
      campaignId,
      clearCurrentBattleSession,
      currentBattleSession,
      navigate,
      queryClient,
      removeBattleInviteNotification,
    ]
  );

  return { answer, busy, failure };
}
