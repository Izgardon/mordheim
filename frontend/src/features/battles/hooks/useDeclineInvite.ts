import { useCallback, useState } from "react";

import { declineBattleInvite } from "@/features/battles/api/battles-api";
import type { BattleState } from "@/features/battles/types/battle-types";
import { getErrorMessage } from "@/lib/get-error-message";

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

  const decline = useCallback(async () => {
    if (battleId === null) {
      return;
    }
    setIsDeclining(true);
    setError("");
    try {
      onDeclined(await declineBattleInvite(campaignId, battleId));
    } catch (errorResponse) {
      setError(getErrorMessage(errorResponse, "Unable to decline the invitation"));
    } finally {
      setIsDeclining(false);
    }
  }, [battleId, campaignId, onDeclined]);

  return { decline, isDeclining, error };
}
