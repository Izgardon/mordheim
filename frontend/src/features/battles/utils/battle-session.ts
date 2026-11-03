import type { BattleState, BattleStatus } from "@/features/battles/types/battle-types";

export type CurrentBattleSession = {
  battleId: number;
  campaignId: number;
  status: BattleStatus;
};

export function toCurrentBattleSession(
  battleState: BattleState | null
): CurrentBattleSession | null {
  if (!battleState) {
    return null;
  }

  return {
    battleId: battleState.battle.id,
    campaignId: battleState.battle.campaign_id,
    status: battleState.battle.status,
  };
}
