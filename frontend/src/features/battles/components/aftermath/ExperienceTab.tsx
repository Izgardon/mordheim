import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import type { BattlePostbattleState } from "@/features/battles/types/battle-types";
import { cn } from "@/lib/utils";

import {
  advanceLabel,
  rollAdvance,
  withAdvances,
  withCorrectedXp,
  xpBlock,
  type XpRow,
} from "./aftermath-xp";

const BOX = { had: "bg-strong", earned: "bg-primary", empty: "bg-transparent" } as const;

function XpCard({
  row,
  isMobile,
  onEarned,
  onAdvances,
}: {
  row: XpRow;
  isMobile: boolean;
  onEarned: (earned: number) => void;
  onAdvances: (advances: XpRow["advances"]) => void;
}) {
  const block = xpBlock(row);
  const fmt = (xp: number) => (Number.isInteger(xp) ? String(xp) : xp.toFixed(1));
  const stepper = (
    <div className={cn("flex shrink-0 items-center", isMobile ? "gap-1" : "gap-2")}>
      <IconButton
        aria-label={`One less experience for ${row.name}`}
        className={isMobile ? "h-10 w-10" : "h-9 w-9"}
        disabled={row.earned <= 0}
        onClick={() => onEarned(row.earned - 1)}
      >
        <Minus aria-hidden="true" />
      </IconButton>
      <span className="min-w-[60px] text-center font-mono text-sm text-text2">
        {fmt(row.from)} → <span className="font-bold text-accent-hi">{fmt(row.to)}</span>
      </span>
      <IconButton
        aria-label={`One more experience for ${row.name}`}
        className={isMobile ? "h-10 w-10" : "h-9 w-9"}
        onClick={() => onEarned(row.earned + 1)}
      >
        <Plus aria-hidden="true" />
      </IconButton>
    </div>
  );
  const boxes = (
    <div
      role="img"
      aria-label={`${fmt(row.to)} of ${block.next} experience`}
      className="flex flex-wrap gap-1"
    >
      {block.boxes.map((box) => (
        <span
          key={box.n}
          className={cn(
            "box-border",
            isMobile ? "h-5 w-5" : "h-[18px] w-[18px]",
            BOX[box.state as keyof typeof BOX],
            box.last ? "border-2 border-accent-hi" : "border border-strong"
          )}
        />
      ))}
    </div>
  );
  const advance =
    block.canAdvance && block.at !== null ? (
      <Button
        className={isMobile ? "min-h-11" : ""}
        onClick={() => onAdvances([...row.advances, rollAdvance(row.group, block.at as number)])}
      >
        Advance at {block.at} · roll 2D6
      </Button>
    ) : null;

  return (
    <article
      className={cn(
        "flex flex-col bg-surface",
        isMobile ? "gap-[9px] p-3" : "gap-3 px-[18px] py-3.5",
        block.canAdvance ? "border border-accent-line" : "border border-border"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2.5">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2
            className={cn(
              "m-0 font-display font-semibold text-head",
              isMobile ? "text-base" : "text-lg"
            )}
          >
            {row.name}{" "}
            <span className="font-sans text-[13px] font-medium text-muted-foreground">
              {row.type}
            </span>
          </h2>
          <span className="text-xs text-muted-foreground">
            {row.canGainXp ? row.reasons || "No experience this battle" : "Gains no experience"}
          </span>
        </div>
        {row.canGainXp ? stepper : null}
      </div>
      {row.advances.map((done, index) => (
        <div key={index} className="flex flex-wrap items-center gap-2.5 text-[13px] text-text2">
          <span className="border border-accent-line bg-accent-soft px-2 py-0.5 font-mono text-xs font-bold text-accent-hi">
            {done.at} XP
          </span>
          <span className="font-mono text-muted-foreground">2D6 {done.rolls.join(" · ")}</span>
          <span className="font-bold text-head">{done.label}</span>
          {!row.group && done.rolls.length === 2 && done.rolls[0] + done.rolls[1] === 7
            ? (["WS", "BS"] as const).map((stat) => (
                <button
                  key={stat}
                  type="button"
                  aria-pressed={done.id === stat}
                  onClick={() =>
                    onAdvances(
                      row.advances.map((entry, i) =>
                        i === index ? { ...entry, id: stat, label: advanceLabel(stat) } : entry
                      )
                    )
                  }
                  className={cn(
                    "min-h-7 border px-2 text-xs font-bold",
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
            onClick={() => onAdvances(row.advances.filter((_, i) => i !== index))}
          >
            Undo
          </button>
        </div>
      ))}
      {row.canGainXp ? (
        isMobile ? (
          <>
            {boxes}
            {advance}
          </>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {boxes}
            {advance}
          </div>
        )
      ) : null}
    </article>
  );
}

/**
 * Experience (design E): each unit's XP from the battle with its reasons, − and + to correct it,
 * the boxes of its current block, and Advance when a threshold is reached; the roll's result
 * shows and the next block follows, so a unit can advance twice. Saved with the draft and taken
 * at Ready.
 */
export default function ExperienceTab({
  draft,
  rows,
  isMobile,
  onChange,
}: {
  draft: BattlePostbattleState;
  rows: XpRow[];
  isMobile: boolean;
  onChange: (next: BattlePostbattleState) => void;
}) {
  if (!rows.length) {
    return <p className="m-0 text-sm text-text2">No unit of yours fought in this battle.</p>;
  }
  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((row) => (
        <XpCard
          key={row.key}
          row={row}
          isMobile={isMobile}
          onEarned={(earned) => onChange(withCorrectedXp(draft, row, earned))}
          onAdvances={(advances) => onChange(withAdvances(draft, row, advances))}
        />
      ))}
    </div>
  );
}
