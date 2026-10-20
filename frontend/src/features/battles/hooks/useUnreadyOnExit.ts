import { useEffect } from "react";

import { setBattleReady } from "@/features/battles/api/battles-api";
import type { BattleStateRef } from "@/features/battles/hooks/useBattleState";

/**
 * Leaving prebattle while ready takes the ready back. Only on unmount, and only if the battle is
 * still in prebattle with you ready: your own Undo Ready, or the battle starting, sends no other
 * unready (BUG-74). The page unmounts as soon as the battle moves on, so it reads the latest state.
 */
export function useUnreadyOnExit({
  campaignId,
  battleId,
  battleStateRef,
  userId,
}: {
  campaignId: number;
  battleId: number;
  battleStateRef: BattleStateRef;
  userId: number | undefined;
}) {
  useEffect(
    () => () => {
      const latest = battleStateRef.current;
      const mine = latest?.participants.find((participant) => participant.user.id === userId);
      if (latest?.battle.status === "prebattle" && mine?.status === "ready") {
        void setBattleReady(campaignId, battleId, false).catch(() => undefined);
      }
    },
    [battleId, battleStateRef, campaignId, userId]
  );
}
