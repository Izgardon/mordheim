import type { BattleState, BattleSummary } from "@/features/battles/types/battle-types";

import { battleNumberLabel } from "./battle-number";

/**
 * What an unfinished battle asks of you, the one that needs you most first: your fight, then
 * your post-game, then a pre-battle, then an invitation to answer.
 */
export const OPEN_BATTLE_PHASES = ["fight", "postgame", "prebattle", "invitation"] as const;
export type OpenBattlePhase = (typeof OPEN_BATTLE_PHASES)[number];

/** The way back to it: the banner's, the overview's and the Battles page's button. */
export const PHASE_ACTION: Record<OpenBattlePhase, string> = {
  fight: "Rejoin",
  postgame: "To the Aftermath",
  prebattle: "Back to pre-battle",
  invitation: "Answer the invitation",
};

/** Where you stand in it, beside it in a list. */
export const PHASE_STATE: Record<OpenBattlePhase, string> = {
  fight: "In the fight",
  postgame: "Post-game",
  prebattle: "Pre-battle",
  invitation: "Invited",
};

/** One of your unfinished battles, from the open battles list's `viewer` (BATL-NEW-01). */
export type YourOpenBattle = {
  state: BattleState;
  phase: OpenBattlePhase;
  /** The page where you carry on. */
  href: string;
  /** "Street Fight, Battle 6". */
  title: string;
};

/** "Street Fight, Battle 6"; "Battle #40" for a battle with neither a scenario nor a number. */
export function openBattleTitle(battle: Pick<BattleSummary, "id" | "scenario" | "number">) {
  const parts = [battle.scenario?.trim(), battleNumberLabel(battle.number)].filter(Boolean);
  return parts.join(", ") || `Battle #${battle.id}`;
}

function toOpenBattle(state: BattleState): YourOpenBattle | null {
  const { battle, viewer } = state;
  if (!viewer?.unfinished || !viewer.page) {
    return null;
  }
  const phase: OpenBattlePhase =
    viewer.page === "active"
      ? "fight"
      : viewer.page === "postbattle"
        ? "postgame"
        : viewer.participant_status === "invited"
          ? "invitation"
          : "prebattle";
  return {
    state,
    phase,
    href: `/campaigns/${battle.campaign_id}/battles/${battle.id}/${viewer.page}`,
    title: openBattleTitle(battle),
  };
}

/**
 * Your unfinished battles (the server lets a player be in several: busy players are warned,
 * never refused), the one that needs you most first; newest first within a phase, as the list
 * comes. `excludeBattleId` leaves out the battle a page is about already.
 */
export function yourOpenBattles(battles: BattleState[], excludeBattleId?: number) {
  return battles
    .filter((state) => state.battle.id !== excludeBattleId)
    .map(toOpenBattle)
    .filter((entry): entry is YourOpenBattle => entry !== null)
    .sort((a, b) => OPEN_BATTLE_PHASES.indexOf(a.phase) - OPEN_BATTLE_PHASES.indexOf(b.phase));
}
