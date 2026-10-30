import { cn } from "@/lib/utils";

import { sideLine, type BattleSide } from "./battle-units";

type SideStripProps = {
  sides: BattleSide[];
  selectedId: string;
  onSelect: (id: string) => void;
  className?: string;
};

/** How full the bar is and its colour: near the rout test it turns to danger; neutrals stay muted. */
function bar(side: BattleSide) {
  if (side.kind === "neutral") {
    return { pct: side.total ? (side.out / side.total) * 100 : 0, tone: "bg-muted-foreground" };
  }
  const pct = Math.min(100, Math.round((side.out / side.routAt) * 100));
  return { pct, tone: side.out >= side.routAt - 1 && side.out > 0 ? "bg-danger" : "bg-primary" };
}

/**
 * The strip under the top bar (design E): a chip for each warband in the battle and each neutral
 * group, with how many are out and a bar towards the rout test. Tapping one shows its units.
 */
export default function SideStrip({ sides, selectedId, onSelect, className }: SideStripProps) {
  return (
    <div
      role="tablist"
      aria-label="Warbands in this battle"
      className={cn("scrollbar-hidden flex gap-1.5 overflow-x-auto", className)}
    >
      {sides.map((side) => {
        const on = side.id === selectedId;
        const { pct, tone } = bar(side);
        return (
          <button
            key={side.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onSelect(side.id)}
            className={cn(
              "flex min-h-[52px] w-[150px] shrink-0 flex-col gap-[3px] border px-2.5 py-1.5 text-left",
              on ? "border-accent-line bg-raised" : "border-border bg-surface"
            )}
          >
            <span className={cn("truncate text-xs font-bold", on ? "text-head" : "text-text2")}>
              {side.kind === "neutral" ? `${side.name} · neutral` : side.name}
            </span>
            <span className="text-[11px] text-muted-foreground">{sideLine(side)}</span>
            <span aria-hidden="true" className="h-[3px] bg-line">
              <span className={cn("block h-[3px]", tone)} style={{ width: `${pct}%` }} />
            </span>
          </button>
        );
      })}
    </div>
  );
}
