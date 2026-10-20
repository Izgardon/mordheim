import { useCallback, useEffect, useRef, useState } from "react";

import { confirmBattleResults } from "@/features/battles/api/battles-api";
import type { BattleCapabilities, BattleState } from "@/features/battles/types/battle-types";
import { toastBattleWarnings } from "@/features/battles/utils/battle-warnings";
import { getErrorMessage } from "@/lib/get-error-message";

/**
 * Confirm results (decision 4): open for the last player to finish (once, as he arrives) or a
 * battle manager, while the battle is in postbattle; `results/` saves them and can be re-sent to
 * change them until the battle ends.
 */
export function useConfirmResults({
  campaignId,
  battleId,
  battleState,
  capabilities,
  userId,
  applyBattleResponse,
}: {
  campaignId: number;
  battleId: number;
  battleState: BattleState;
  capabilities: BattleCapabilities | null;
  userId: number | undefined;
  applyBattleResponse: (next: BattleState) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const { battle } = battleState;
  const canConfirm = Boolean(capabilities?.confirm_results);
  const pending = Boolean(battle.results_pending);
  const isConfirmer = battle.results_confirmer_user_id === userId;

  // The last player to finish is asked straight away, once per battle.
  const askedRef = useRef<number | null>(null);
  useEffect(() => {
    if (canConfirm && pending && isConfirmer && askedRef.current !== battle.id) {
      askedRef.current = battle.id;
      setIsOpen(true);
    }
  }, [battle.id, canConfirm, isConfirmer, pending]);

  const openChange = useCallback((open: boolean) => {
    setIsOpen(open);
    setError("");
  }, []);

  const submit = useCallback(
    async (results: { winners: number[]; losers: number[] }) => {
      setIsSubmitting(true);
      setError("");
      try {
        const next = await confirmBattleResults(campaignId, battleId, results);
        toastBattleWarnings(next.warnings);
        applyBattleResponse(next);
        setIsOpen(false);
      } catch (errorResponse) {
        setError(getErrorMessage(errorResponse, "Unable to confirm the results"));
      } finally {
        setIsSubmitting(false);
      }
    },
    [applyBattleResponse, battleId, campaignId]
  );

  return { canConfirm, pending, isOpen, openChange, isSubmitting, error, submit };
}

export type ConfirmResults = ReturnType<typeof useConfirmResults>;
