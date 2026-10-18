import { useCallback, useEffect, useState } from "react";

import { finishBattle } from "@/features/battles/api/battles-api";
import type { BattleState } from "@/features/battles/types/battle-types";
import { getErrorMessage } from "@/lib/get-error-message";

/**
 * The creator's End battle: the winners picked (or No winner, decision 8), the request and its
 * error. Opening the dialog starts from a clean pick.
 */
export function useFinishBattle({
  campaignId,
  battleId,
  applyBattleResponse,
}: {
  campaignId: number;
  battleId: number;
  applyBattleResponse: (next: BattleState) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [error, setError] = useState("");
  const [winnerWarbandIds, setWinnerWarbandIds] = useState<number[]>([]);
  const [noWinner, setNoWinner] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setError("");
    setWinnerWarbandIds([]);
    setNoWinner(false);
  }, [isOpen]);

  const toggleWinner = useCallback((warbandId: number, isWinner: boolean) => {
    setNoWinner(false);
    setWinnerWarbandIds((current) => {
      if (isWinner) {
        return current.includes(warbandId) ? current : [...current, warbandId];
      }
      return current.filter((entry) => entry !== warbandId);
    });
  }, []);

  const toggleNoWinner = useCallback((checked: boolean) => {
    setNoWinner(checked);
    setWinnerWarbandIds([]);
  }, []);

  const finish = useCallback(async () => {
    if (winnerWarbandIds.length === 0 && !noWinner) {
      setError("Pick the winners, or No winner.");
      return;
    }
    setIsFinishing(true);
    setError("");
    try {
      const next = await finishBattle(campaignId, battleId, {
        winner_warband_ids: noWinner ? [] : winnerWarbandIds,
      });
      applyBattleResponse(next);
      setIsOpen(false);
    } catch (errorResponse) {
      setError(getErrorMessage(errorResponse, "Unable to end battle"));
    } finally {
      setIsFinishing(false);
    }
  }, [applyBattleResponse, battleId, campaignId, noWinner, winnerWarbandIds]);

  return {
    isOpen,
    setIsOpen,
    isFinishing,
    error,
    winnerWarbandIds,
    noWinner,
    toggleWinner,
    toggleNoWinner,
    finish,
  };
}

export type FinishBattleState = ReturnType<typeof useFinishBattle>;
