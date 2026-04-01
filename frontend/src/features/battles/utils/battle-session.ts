import type { BattleState, BattleStatus } from "@/features/battles/types/battle-types";

export type CurrentBattleSession = {
  battleId: number;
  campaignId: number;
  status: BattleStatus;
};

export function getBattleRouteForStatus(status: BattleStatus) {
  if (status === "active") {
    return "active";
  }
  if (status === "postbattle") {
    return "postbattle";
  }
  return "prebattle";
}

export function getResumableBattleForUser(
  battleStates: BattleState[],
  userId?: number | null
) {
  if (!userId) {
    return null;
  }

  return (
    battleStates.find((state) => {
      if (state.battle.flow_type !== "normal") {
        return false;
      }
      if (state.battle.status === "ended" || state.battle.status === "canceled") {
        return false;
      }
      const participant = state.participants.find((entry) => entry.user.id === userId);
      return (
        participant?.status !== "confirmed_postbattle" &&
        participant?.status !== "canceled_prebattle"
      );
    }) ?? null
  );
}

export function toCurrentBattleSession(battleState: BattleState | null): CurrentBattleSession | null {
  if (!battleState) {
    return null;
  }

  return {
    battleId: battleState.battle.id,
    campaignId: battleState.battle.campaign_id,
    status: battleState.battle.status,
  };
}
