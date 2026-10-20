import { useCallback, useState } from "react";

import { cancelBattleAsCreator } from "@/features/battles/api/battles-api";
import type { BattleState } from "@/features/battles/types/battle-types";
import { getErrorMessage } from "@/lib/get-error-message";

/** The creator's Cancel battle (prebattle, active): its confirm, request and error. */
export function useCreatorCancel({
  campaignId,
  battleId,
  applyBattleResponse,
}: {
  campaignId: number;
  battleId: number;
  applyBattleResponse: (next: BattleState) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [error, setError] = useState("");

  const cancel = useCallback(async () => {
    setIsCanceling(true);
    setError("");
    try {
      applyBattleResponse(await cancelBattleAsCreator(campaignId, battleId));
      setIsOpen(false);
    } catch (errorResponse) {
      setError(getErrorMessage(errorResponse, "Unable to cancel battle"));
    } finally {
      setIsCanceling(false);
    }
  }, [applyBattleResponse, battleId, campaignId]);

  return { isOpen, setIsOpen, isCanceling, error, setError, cancel };
}
