import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import DiceEntry from "@/components/ui/dice-entry";
import { IconButton } from "@/components/ui/icon-button";
import type { BattlePostbattleState } from "@/features/battles/types/battle-types";
import { cn } from "@/lib/utils";

import {
  isRepeat,
  rollAdvance,
  withAdvances,
  withCorrectedXp,
  xpBlock,
  type XpRow,
} from "./aftermath-xp";
import XpAdvanceLine from "./XpAdvanceLine";

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
  const at = block.at;
  const advance =
    block.canAdvance && at !== null ? (
      <DiceEntry
        // the next advance starts with empty boxes
        key={row.advances.length}
        dice="2D6"
        onFaces={(faces) => onAdvances([...row.advances, rollAdvance(row.group, at, faces)])}
        button={(roll) => (
          <Button className={isMobile ? "min-h-11 flex-1" : ""} onClick={roll}>
            Advance at {at} · roll 2D6
          </Button>
        )}
      />
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
      {row.advances.map((_, index) => (
        <XpAdvanceLine
          key={index}
          row={row}
          index={index}
          repeat={isRepeat(row, index)}
          onAdvances={onAdvances}
        />
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
 * the boxes of its current block, and Advance when a threshold is reached (its 2D6 rolled or typed
 * in, and then a hero's follow-up D6 the same way, from an empty box: the app never rolls that one
 * for him); the roll's result shows and the next block follows, so a unit can advance twice. A
 * repeat is greyed, warned about and rolled again (`XpAdvanceLine`). Saved with the draft and taken
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
