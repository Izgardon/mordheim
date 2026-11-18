import { Button } from "@/components/ui/button";
import DiceEntry from "@/components/ui/dice-entry";
import type { BattlePostbattleAdvance } from "@/features/battles/types/battle-types";
import { TALENT_AGAIN_NOTE } from "@/features/warbands/utils/levelup-utils";
import { cn } from "@/lib/utils";

import {
  advanceLabel,
  awaitsFollowUp,
  rollAdvance,
  withAdvanceAt,
  withFollowUp,
  type XpRow,
} from "./aftermath-xp";

const PILL = "min-h-7 border px-2 text-xs font-bold";

/**
 * One advance already rolled in the Experience step: the XP it came at, the 2D6 that gave it, a
 * hero's follow-up D6 (rolled or typed from an empty box), what it gives, and Undo. A repeat — the
 * lad's got talent on a group that has just had it — is greyed with the warning and a 2D6 to roll
 * again (William, 12 Nov 2026: "greyed with a warning, and a prompt to re-roll"), the same bar the
 * warband page's advance dialog puts on the table before the roll. Nothing is refused.
 */
export default function XpAdvanceLine({
  row,
  index,
  repeat,
  onAdvances,
}: {
  row: XpRow;
  index: number;
  repeat: boolean;
  onAdvances: (advances: XpRow["advances"]) => void;
}) {
  const done = row.advances[index];
  const put = (advance: BattlePostbattleAdvance) =>
    onAdvances(withAdvanceAt(row.advances, index, advance));
  const choosable = !row.group && done.rolls.length === 2 && done.rolls[0] + done.rolls[1] === 7;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2.5 text-[13px] text-text2">
        <span className="border border-accent-line bg-accent-soft px-2 py-0.5 font-mono text-xs font-bold text-accent-hi">
          {done.at} XP
        </span>
        <span className="font-mono text-muted-foreground">
          2D6 {done.rolls.slice(0, 2).join(" · ")}
        </span>
        {done.rolls.length > 2 || awaitsFollowUp(done) ? (
          <DiceEntry
            dice="D6"
            size="sm"
            total={done.rolls[2] ?? null}
            onFaces={([face]) => put(withFollowUp(done, face))}
            button={(roll) => (
              <Button size="sm" variant="secondary" className="h-9" onClick={roll}>
                Roll D6
              </Button>
            )}
          />
        ) : null}
        <span className={cn("font-bold", repeat ? "text-muted-foreground" : "text-head")}>
          {done.label}
        </span>
        {choosable
          ? (["WS", "BS"] as const).map((stat) => (
              <button
                key={stat}
                type="button"
                aria-pressed={done.id === stat}
                onClick={() => put({ ...done, id: stat, label: advanceLabel(stat) })}
                className={cn(
                  PILL,
                  done.id === stat
                    ? "border-accent-line bg-accent-soft text-accent-hi"
                    : "border-border text-muted-foreground"
                )}
              >
                {stat}
              </button>
            ))
          : null}
        <button
          type="button"
          className="text-xs font-semibold text-muted-foreground hover:text-ink"
          onClick={() => onAdvances(row.advances.filter((_, at) => at !== index))}
        >
          Undo
        </button>
      </div>
      {repeat ? (
        <div className="flex flex-wrap items-center gap-2.5">
          <p role="alert" className="m-0 text-[13px] font-semibold text-danger">
            {TALENT_AGAIN_NOTE}
          </p>
          <DiceEntry
            // a roll again starts from empty boxes
            key={done.rolls.join("-")}
            dice="2D6"
            size="sm"
            onFaces={(faces) => put(rollAdvance(row.group, done.at, faces))}
            button={(roll) => (
              <Button size="sm" variant="secondary" className="h-9" onClick={roll}>
                Roll again
              </Button>
            )}
          />
        </div>
      ) : null}
    </div>
  );
}
