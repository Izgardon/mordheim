import { useCallback } from "react";
import { toast } from "sonner";

import { voidBattleEvent } from "@/features/battles/api/battles-api";
import type { BattleState } from "@/features/battles/types/battle-types";
import { getErrorMessage } from "@/lib/get-error-message";

/**
 * Undoing your own kill or item use until you finalise (BUG-11, decision 5): `undo` voids the
 * event and applies the answer; `offerUndo` shows a toast with an Undo action for a write just made.
 */
export function useEventUndo({
  campaignId,
  battleId,
  applyBattleResponse,
}: {
  campaignId: number;
  battleId: number;
  applyBattleResponse: (next: BattleState) => void;
}) {
  const undo = useCallback(
    async (eventId: number) => {
      try {
        applyBattleResponse(await voidBattleEvent(campaignId, battleId, eventId));
      } catch (error) {
        toast.error(getErrorMessage(error, "Couldn't undo that."));
        throw error;
      }
    },
    [applyBattleResponse, battleId, campaignId]
  );

  const offerUndo = useCallback(
    (message: string, eventId: number | undefined) => {
      if (eventId === undefined) {
        return;
      }
      toast(message, {
        id: `battle-undo-${eventId}`,
        action: { label: "Undo", onClick: () => void undo(eventId).catch(() => undefined) },
      });
    },
    [undo]
  );

  return { undo, offerUndo };
}
