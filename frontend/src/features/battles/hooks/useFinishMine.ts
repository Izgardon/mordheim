import { useCallback, useEffect, useState } from "react";

import { finishMyBattle, type DeclaredResult } from "@/features/battles/api/battles-api";
import type { BattleState } from "@/features/battles/types/battle-types";
import { getErrorMessage } from "@/lib/get-error-message";

/**
 * Finish my battle (decision 4): you declare won, lost or "decide when the battle ends", and your
 * postbattle opens while the others play on. Opening the dialog starts from no choice.
 */
export function useFinishMine({
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
  const [result, setResult] = useState<DeclaredResult | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError("");
      setResult(null);
    }
  }, [isOpen]);

  const finish = useCallback(async () => {
    if (!result) {
      setError("Say how your battle went.");
      return;
    }
    setIsFinishing(true);
    setError("");
    try {
      applyBattleResponse(await finishMyBattle(campaignId, battleId, result));
      setIsOpen(false);
    } catch (errorResponse) {
      setError(getErrorMessage(errorResponse, "Unable to finish your battle"));
    } finally {
      setIsFinishing(false);
    }
  }, [applyBattleResponse, battleId, campaignId, result]);

  return { isOpen, setIsOpen, isFinishing, error, result, setResult, finish };
}

export type FinishMineState = ReturnType<typeof useFinishMine>;
