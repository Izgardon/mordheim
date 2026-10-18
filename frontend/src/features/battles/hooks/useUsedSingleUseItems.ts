import { useCallback, useMemo, useState } from "react";

import { appendBattleEvent } from "@/features/battles/api/battles-api";
import type {
  PrebattleUnit,
  UnitSingleUseItem,
} from "@/features/battles/components/prebattle/prebattle-types";
import { useEventUndo } from "@/features/battles/hooks/useEventUndo";
import type {
  BattleEvent,
  BattleParticipant,
  BattleState,
} from "@/features/battles/types/battle-types";
import {
  latestItemUseEvent,
  newestOwnEvent,
  usedSingleUseItemCounts,
} from "@/features/battles/utils/battle-events";
import { getErrorMessage } from "@/lib/get-error-message";

/** How many of a unit's single-use item are used up in this battle; undone uses don't count (BUG-11). */
export function useUsedSingleUseItems(events: BattleEvent[]) {
  const counts = useMemo(() => usedSingleUseItemCounts(events), [events]);
  return useCallback((unitKey: string, itemId: number) => counts[unitKey]?.[itemId] ?? 0, [counts]);
}

/**
 * Using a single-use item (prebattle, active): the item_used event with an Undo toast, and undoing
 * your latest use of it from the unit's details (BUG-11). `activeItemActionKey` is the use in flight.
 */
export function useSingleUseItemActions({
  campaignId,
  battleId,
  events,
  currentParticipant,
  userId,
  applyBattleResponse,
  setActionError,
}: {
  campaignId: number;
  battleId: number;
  events: BattleEvent[];
  currentParticipant: BattleParticipant | null;
  userId: number | undefined;
  applyBattleResponse: (next: BattleState) => void;
  setActionError: (message: string) => void;
}) {
  const [activeItemActionKey, setActiveItemActionKey] = useState<string | null>(null);
  const { undo, offerUndo } = useEventUndo({ campaignId, battleId, applyBattleResponse });

  const logItemUse = useCallback(
    async (unit: PrebattleUnit, item: UnitSingleUseItem) => {
      if (!currentParticipant) {
        return;
      }
      const actionKey = `${unit.key}:${item.id}`;
      setActiveItemActionKey(actionKey);
      setActionError("");
      try {
        const next = await appendBattleEvent(campaignId, battleId, {
          type: "item_used",
          payload_json: {
            participant_user_id: currentParticipant.user.id,
            unit_key: unit.key,
            unit_id: typeof unit.id === "number" ? unit.id : null,
            unit_type: unit.kind,
            item_id: item.id,
            item_name: item.name,
          },
        });
        applyBattleResponse(next);
        offerUndo(`${item.name} used.`, newestOwnEvent(next.events, "item_used", userId)?.id);
      } catch (errorResponse) {
        setActionError(getErrorMessage(errorResponse, "Unable to log item use"));
      } finally {
        setActiveItemActionKey((prev) => (prev === actionKey ? null : prev));
      }
    },
    [
      applyBattleResponse,
      battleId,
      campaignId,
      currentParticipant,
      offerUndo,
      setActionError,
      userId,
    ]
  );

  const undoItemUse = useCallback(
    async (unit: PrebattleUnit, itemId: number) => {
      const event = latestItemUseEvent(events, unit.key, itemId, userId);
      if (event) {
        await undo(event.id);
      }
    },
    [events, undo, userId]
  );

  return { activeItemActionKey, setActiveItemActionKey, logItemUse, undoItemUse };
}
