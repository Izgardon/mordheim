import type {
  BattleParticipant,
  BattlePostbattleState,
  BattleState,
} from "@/features/battles/types/battle-types";
import { cn } from "@/lib/utils";

import { AFTERMATH_ASIDE } from "./aftermath-layout";

const LEFT = new Set(["declined", "canceled_prebattle", "reported_result_declined"]);

/** How a player stands in the battle, for "Everyone else". */
function standing(participant: BattleParticipant) {
  switch (participant.status) {
    case "confirmed_postbattle":
      return { text: "Ready", tone: "text-good" };
    case "finished_battle":
      return { text: "In the aftermath", tone: "text-accent-text" };
    case "in_battle":
      return { text: "Still fighting", tone: "text-muted-foreground" };
    default:
      return { text: "Not in the fight", tone: "text-faint" };
  }
}

/** "Won", "Lost" or "No winner" once confirmed; what the player declared while they wait. */
export function resultText(state: BattleState, warbandId: number, declared?: string | null) {
  const winners = state.battle.winner_warband_ids_json ?? [];
  if (!state.battle.results_pending && state.battle.status !== "active") {
    if (!winners.length) return "No winner";
    return winners.includes(warbandId) ? "Won" : "Lost";
  }
  if (declared === "won") return "Won (to confirm)";
  if (declared === "lost") return "Lost (to confirm)";
  return "Waiting for the results";
}

export const opponentsOf = (state: BattleState, me: BattleParticipant) =>
  state.participants
    .filter((entry) => entry.id !== me.id && !LEFT.has(entry.status))
    .map((entry) => entry.warband.name);

/** The Aftermath's aside (design E): the battle's facts and where everyone else stands. */
export default function AftermathAside({
  state,
  me,
  draft,
}: {
  state: BattleState;
  me: BattleParticipant;
  draft: BattlePostbattleState;
}) {
  const results = Object.values(draft.unit_results);
  const kills = results.reduce((sum, result) => sum + (result.kill_count || 0), 0);
  const out = results.filter((result) => result.out_of_action).map((r) => r.unit_name);
  const facts = [
    { k: "Result", v: resultText(state, me.warband.id, me.declared_result) },
    { k: "Opponent", v: opponentsOf(state, me).join(", ") || "Nobody" },
    { k: "Scenario", v: state.battle.scenario || "None named" },
    { k: "Your kills", v: String(kills) },
    { k: "Out of action", v: out.join(", ") || "Nobody" },
  ];
  const others = state.participants.filter(
    (entry) => entry.id !== me.id && !LEFT.has(entry.status)
  );

  return (
    <aside className={AFTERMATH_ASIDE}>
      <section
        aria-labelledby="aftermath-facts"
        className="flex flex-col gap-2.5 border border-border bg-surface px-[18px] py-4"
      >
        <h2
          id="aftermath-facts"
          className="m-0 text-[11px] font-bold uppercase tracking-[0.14em] text-faint"
        >
          The battle
        </h2>
        <dl className="m-0 flex flex-col">
          {facts.map((fact) => (
            <div key={fact.k} className="flex justify-between gap-3 border-t border-line py-[7px]">
              <dt className="text-[13px] text-muted-foreground">{fact.k}</dt>
              <dd className="m-0 text-right text-[13px] font-semibold text-ink">{fact.v}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section aria-labelledby="aftermath-others" className="flex flex-col gap-2">
        <h2
          id="aftermath-others"
          className="m-0 text-[11px] font-bold uppercase tracking-[0.14em] text-faint"
        >
          Everyone else
        </h2>
        {others.map((entry) => {
          const where = standing(entry);
          return (
            <div key={entry.id} className="flex justify-between gap-3 border-t border-line py-2">
              <span className="text-[13px] text-ink">
                {entry.user.label} · {entry.warband.name}
              </span>
              <span className={cn("text-xs font-semibold", where.tone)}>{where.text}</span>
            </div>
          );
        })}
      </section>
    </aside>
  );
}
