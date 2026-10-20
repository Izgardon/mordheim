import type { ResultsWarband } from "@/features/battles/components/shared/BattleResultsDialog";
import type { BattleParticipant, BattleState } from "@/features/battles/types/battle-types";

const LEFT = new Set(["declined", "canceled_prebattle", "reported_result_declined"]);

/** The warbands still in the battle, as the results modal's cards (decision 4). */
export function resultsWarbands(
  participants: Pick<BattleParticipant, "status" | "warband" | "user" | "declared_result">[]
): ResultsWarband[] {
  return participants
    .filter((participant) => !LEFT.has(participant.status))
    .map((participant) => ({
      warbandId: participant.warband.id,
      warbandName: participant.warband.name,
      playerLabel: participant.user.label,
      declared: participant.declared_result ?? null,
    }));
}

/**
 * Where the Winners column starts: the declared winners while the results wait (the server's
 * `confirm_results`, else each player's declaration), the battle's winners once confirmed.
 */
export function initialResultsWinners(state: BattleState) {
  if (state.battle.results_pending) {
    return (
      state.confirm_results?.winners ??
      state.participants
        .filter((participant) => participant.declared_result === "won")
        .map((participant) => participant.warband.id)
    );
  }
  return state.battle.winner_warband_ids_json ?? [];
}

/** "Raider Band won", "Raider Band and Rival Band won" or "No winner". */
export function winnersText(state: BattleState) {
  const winners = state.battle.winner_warband_ids_json ?? [];
  const names = state.participants
    .filter((participant) => winners.includes(participant.warband.id))
    .map((participant) => participant.warband.name);
  return names.length > 0 ? `${names.join(" and ")} won` : "No winner";
}
