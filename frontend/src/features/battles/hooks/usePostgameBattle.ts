import { useMemo } from "react";

import { useAuth } from "@/features/auth/hooks/use-auth";
import { useBattleCapabilities } from "@/features/battles/hooks/useBattleCapabilities";
import { useBattleRosters } from "@/features/battles/hooks/useBattleRosters";
import { useBattleState } from "@/features/battles/hooks/useBattleState";
import { useCampaignBattleRules } from "@/features/battles/hooks/useCampaignBattleRules";

/**
 * A battle as the post-game reads it (the Aftermath page and camp on the warband page): its state
 * in the postbattle view (which carries the server's rules and suggestions), every roster, the
 * reader's capabilities, and his own participant and roster. Kept current by the battle channel.
 */
export function usePostgameBattle(campaignId: number, battleId: number, managesBattles = false) {
  const { user } = useAuth();
  const reader = useMemo(() => ({ userId: user?.id, managesBattles }), [managesBattles, user?.id]);
  const state = useBattleState({ campaignId, battleId, view: "postbattle", reader });
  const { rosters, rosterLoading, rosterErrors } = useBattleRosters(
    campaignId,
    battleId,
    state.battleState?.participants
  );
  // Broadcasts may leave the rules out, or their injury lines; the campaign's last ones stand in.
  const rules = useCampaignBattleRules(campaignId, state.battleState?.rules);
  const cached = state.battleState;
  const battleState = useMemo(
    () => (cached && rules && cached.rules !== rules ? { ...cached, rules } : cached),
    [cached, rules]
  );
  const capabilities = useBattleCapabilities({
    battleState,
    onPage: true,
    joinRead: state.joinRead,
  });
  const participant = battleState?.participants.find((entry) => entry.user.id === user?.id) ?? null;
  const userId = participant?.user.id;

  return {
    ...state,
    battleState,
    capabilities,
    rosters,
    participant,
    roster: userId !== undefined ? rosters[userId] : undefined,
    rosterLoading: userId !== undefined ? Boolean(rosterLoading[userId]) : false,
    rosterError: userId !== undefined ? (rosterErrors[userId] ?? "") : "",
    userId: user?.id,
  };
}

export type PostgameBattle = ReturnType<typeof usePostgameBattle>;
