import { useCallback, useState } from "react";

import { startBattle } from "@/features/battles/api/battles-api";
import type { BattleState } from "@/features/battles/types/battle-types";
import { getErrorMessage } from "@/lib/get-error-message";

/** The creator's Start battle: its confirm, request and error (cleared when the confirm closes). */
export function usePrebattleStart({
  campaignId,
  battleId,
  applyBattleResponse,
}: {
  campaignId: number;
  battleId: number;
  applyBattleResponse: (next: BattleState) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState("");

  const openChange = useCallback((open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setError("");
    }
  }, []);

  const start = useCallback(async () => {
    setIsStarting(true);
    setError("");
    try {
      applyBattleResponse(await startBattle(campaignId, battleId));
      setIsOpen(false);
    } catch (errorResponse) {
      setError(getErrorMessage(errorResponse, "Unable to start battle"));
    } finally {
      setIsStarting(false);
    }
  }, [applyBattleResponse, battleId, campaignId]);

  return { isOpen, setIsOpen, openChange, isStarting, error, start };
}
