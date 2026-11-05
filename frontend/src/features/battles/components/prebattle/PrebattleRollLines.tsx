import DiceEntry from "@/components/ui/dice-entry";
import type { PrebattleRolls } from "@/features/battles/hooks/usePrebattleRolls";
import { rollReading, type PrebattleRollLine } from "@/features/battles/utils/prebattle-rolls";
import { cn } from "@/lib/utils";

type PrebattleRollLinesProps = {
  lines: PrebattleRollLine[];
  /** Whose rolls they are: a unit's key, or a henchmen group's ("group:2"). */
  owner: string;
  rolls: PrebattleRolls;
  className?: string;
};

/**
 * A unit's rolls before the battle, one line each: the rule that asks for it, the dice boxes
 * (Roll, or the faces rolled at the table) and what the roll does. Nothing is applied or saved.
 */
export default function PrebattleRollLines({
  lines,
  owner,
  rolls,
  className,
}: PrebattleRollLinesProps) {
  if (!lines.length) return null;
  return (
    <ul className={cn("m-0 flex list-none flex-col gap-2 p-0", className)}>
      {lines.map((line) => {
        const key = `${owner}|${line.key}`;
        const faces = rolls.faces[key];
        const total = faces ? faces.reduce((sum, face) => sum + face, 0) : null;
        return (
          <li key={line.key} className="flex flex-col gap-1 border-l-2 border-accent-line pl-2.5">
            <div
              role="group"
              aria-label={`${line.source} roll`}
              className="flex flex-wrap items-center gap-x-3 gap-y-1"
            >
              <span className="min-w-0 text-[13px] font-semibold text-head">{line.source}</span>
              <DiceEntry
                dice={line.dice}
                size="sm"
                className="gap-1.5"
                total={total}
                onFaces={(rolled) => rolls.setRoll(key, rolled)}
                onChange={(typed) =>
                  typed.some((face) => face === null) ? rolls.setRoll(key, null) : undefined
                }
                button={(roll) => (
                  <button
                    type="button"
                    className="text-xs font-bold text-accent-text hover:underline"
                    onClick={roll}
                  >
                    {faces ? "Roll again" : `Roll ${line.dice}`}
                  </button>
                )}
              />
              {faces && faces.length > 1 ? (
                <span className="font-mono text-sm font-bold text-accent-hi">
                  = {rollReading(line.dice, faces)}
                </span>
              ) : null}
            </div>
            {line.text ? (
              <p className="m-0 whitespace-pre-line text-xs text-muted-foreground">{line.text}</p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
