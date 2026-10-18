import { useCallback, useState } from "react";

import { closePostbattle } from "@/features/battles/api/battles-api";
import type { BattleState } from "@/features/battles/types/battle-types";
import { getErrorMessage } from "@/lib/get-error-message";

/** Close postbattle's confirm and request (BUG-09): `onClosed` gets the ended battle. */
export function useClosePostbattle({
  campaignId,
  battleId,
  onClosed,
}: {
  campaignId: number;
  battleId: number;
  onClosed: (next: BattleState) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [error, setError] = useState("");

  const openChange = useCallback((open: boolean) => {
    setIsOpen(open);
    setError("");
  }, []);

  const close = useCallback(async () => {
    setIsClosing(true);
    setError("");
    try {
      const next = await closePostbattle(campaignId, battleId);
      setIsOpen(false);
      onClosed(next);
    } catch (errorResponse) {
      setError(getErrorMessage(errorResponse, "Unable to close postbattle"));
    } finally {
      setIsClosing(false);
    }
  }, [battleId, campaignId, onClosed]);

  return { isOpen, openChange, isClosing, error, close };
}
