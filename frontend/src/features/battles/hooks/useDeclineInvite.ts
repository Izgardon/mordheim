import { useCallback, useState } from "react";

import { declineBattleInvite } from "@/features/battles/api/battles-api";
import type { BattleState } from "@/features/battles/types/battle-types";
import { getErrorMessage } from "@/lib/get-error-message";
import { useAppStore } from "@/stores/app-store";

/** Declining a battle invite (BUG-45), with its pending and error state. Final once sent. */
export function useDeclineInvite({
  campaignId,
  battleId,
  onDeclined,
}: {
  campaignId: number;
  battleId: number | null;
  onDeclined: (next: BattleState) => void;
}) {
  const [isDeclining, setIsDeclining] = useState(false);
  const [error, setError] = useState("");
  const { currentBattleSession, clearCurrentBattleSession, removeBattleInviteNotification } =
    useAppStore();

  const decline = useCallback(async () => {
    if (battleId === null) {
      return;
    }
    setIsDeclining(true);
    setError("");
    try {
      const next = await declineBattleInvite(campaignId, battleId);
      // The server resolved the invite: the bell and the Rejoin button let it go too.
      removeBattleInviteNotification(`battle-${battleId}`);
      if (currentBattleSession?.battleId === battleId) {
        clearCurrentBattleSession();
      }
      onDeclined(next);
    } catch (errorResponse) {
      setError(getErrorMessage(errorResponse, "Unable to decline the invitation"));
    } finally {
      setIsDeclining(false);
    }
  }, [
    battleId,
    campaignId,
    clearCurrentBattleSession,
    currentBattleSession,
    onDeclined,
    removeBattleInviteNotification,
  ]);

  return { decline, isDeclining, error };
}
