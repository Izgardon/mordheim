import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { ModalSheet } from "@/components/ui/modal-sheet";
import type { ConfirmResults } from "@/features/battles/hooks/useConfirmResults";
import type { BattleState } from "@/features/battles/types/battle-types";

const LEFT = new Set(["declined", "canceled_prebattle", "reported_result_declined"]);

/** Where the Winners start: the declared winners while the results wait, the battle's once set. */
function startingWinners(state: BattleState) {
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

/**
 * The results (decision 4): waiting for the last player to finish, or Confirm results for him or
 * a battle manager, which picks the winners (none is No winner); changeable until the battle ends.
 */
export default function ResultsBanner({
  state,
  results,
}: {
  state: BattleState;
  results: ConfirmResults;
}) {
  const { battle, participants } = state;
  const warbands = participants.filter((participant) => !LEFT.has(participant.status));
  const [winners, setWinners] = useState<number[]>(() => startingWinners(state));
  if (battle.status !== "postbattle") return null;
  const confirmer = participants.find(
    (entry) => entry.user.id === battle.results_confirmer_user_id
  );
  const names = (ids: number[]) =>
    warbands.filter((entry) => ids.includes(entry.warband.id)).map((entry) => entry.warband.name);
  const confirmed = names(battle.winner_warband_ids_json ?? []);
  const text = battle.results_pending
    ? results.canConfirm
      ? "Everyone has finished fighting. Confirm who won: the battle ends once the results are confirmed and every aftermath is done."
      : `Waiting for ${confirmer?.user.label ?? "the last player to finish"} to confirm the results.`
    : results.canConfirm
      ? `Results confirmed: ${confirmed.length ? `${confirmed.join(" and ")} won` : "no winner"}. You can change them until the battle ends.`
      : null;
  if (!text) return null;
  const open = (next: boolean) => {
    if (next) setWinners(startingWinners(state));
    results.openChange(next);
  };

  return (
    <>
      <section
        aria-label="Results"
        className="flex flex-wrap items-center justify-between gap-3 border border-accent-line bg-panel px-4 py-3"
      >
        <p className="m-0 text-sm text-ink">{text}</p>
        {results.canConfirm ? (
          <Button size="sm" onClick={() => open(true)}>
            {battle.results_pending ? "Confirm results" : "Change results"}
          </Button>
        ) : null}
      </section>
      <ModalSheet
        open={results.isOpen}
        onOpenChange={open}
        kicker="The battle"
        title="Who won?"
        footer={
          <div className="grid w-full grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-2">
            <Button variant="secondary" onClick={() => open(false)}>
              Not yet
            </Button>
            <Button
              disabled={results.isSubmitting}
              onClick={() =>
                void results.submit({
                  winners,
                  losers: warbands
                    .map((entry) => entry.warband.id)
                    .filter((id) => !winners.includes(id)),
                })
              }
            >
              {winners.length ? `${names(winners).join(" and ")} won` : "No winner"}
            </Button>
          </div>
        }
      >
        <p className="m-0 text-sm text-text2">Pick the winners. Nobody picked is No winner.</p>
        <div role="group" aria-label="Winners" className="flex flex-wrap gap-1.5">
          {warbands.map((entry) => {
            const on = winners.includes(entry.warband.id);
            return (
              <Chip
                key={entry.id}
                pressed={on}
                onClick={() =>
                  setWinners((list) =>
                    on ? list.filter((id) => id !== entry.warband.id) : [...list, entry.warband.id]
                  )
                }
              >
                {entry.warband.name}
                <span className="text-xs text-muted-foreground">{entry.user.label}</span>
              </Chip>
            );
          })}
        </div>
        {results.error ? <p className="m-0 text-sm text-danger">{results.error}</p> : null}
      </ModalSheet>
    </>
  );
}
