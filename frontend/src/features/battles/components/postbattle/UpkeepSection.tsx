import { Checkbox } from "@/components/ui/checkbox";
import PostbattleSection, {
  POSTBATTLE_SECTION_LABELS,
} from "@/features/battles/components/postbattle/PostbattleSection";
import PostbattleStepperInput from "@/features/battles/components/postbattle/PostbattleStepperInput";
import type { UpkeepRow } from "@/features/battles/components/postbattle/postbattle-summary";

/** Upkeep: each hired sword's cost (none for the dead), the total, and Pay upkeep. */
export default function UpkeepSection({
  isMobile,
  rows,
  total,
  payUpkeep,
  isFinalized,
  onCommitCost,
  onTogglePayUpkeep,
}: {
  isMobile: boolean;
  rows: UpkeepRow[];
  total: number;
  payUpkeep: boolean;
  isFinalized: boolean;
  onCommitCost: (unitKey: string, cost: number) => void;
  onTogglePayUpkeep: (checked: boolean) => void;
}) {
  return (
    <PostbattleSection
      section="upkeep"
      isMobile={isMobile}
      className={isMobile ? "battle-mobile-section-divider" : undefined}
    >
      <div>
        <p className="battle-section-title">{POSTBATTLE_SECTION_LABELS.upkeep}</p>
      </div>
      <div className="battle-inline-panel space-y-3 p-3">
        {rows.map((row, index) => (
          <div
            key={row.unitKey}
            className={`space-y-2 ${index > 0 ? "border-t border-border/40 pt-3" : ""}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-foreground">{row.unitName}</p>
                <p className="text-xs text-muted-foreground">{row.unitType}</p>
              </div>
              {row.hasFixedCost ? (
                <label className="space-y-1">
                  <span className="block text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                    Upkeep
                  </span>
                  <PostbattleStepperInput
                    value={row.cost ?? 0}
                    min={0}
                    disabled={isFinalized || row.dead}
                    onCommit={(nextCost) => onCommitCost(row.unitKey, nextCost)}
                  />
                </label>
              ) : (
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                    Upkeep
                  </p>
                  <p className="text-sm text-foreground">
                    {row.costExpression || "No fixed upkeep cost"}
                  </p>
                </div>
              )}
            </div>
            {row.dead ? (
              <p className="text-xs text-muted-foreground">
                Excluded from upkeep total because this hired sword is marked dead.
              </p>
            ) : null}
          </div>
        ))}
        <div className="flex flex-wrap items-end justify-between gap-3 border-t border-border/40 pt-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              Total Cost
            </p>
            <div className="battle-metric-box mt-1 flex h-10 min-w-24 items-center px-3 text-sm font-semibold text-foreground">
              {total} gc
            </div>
          </div>
          <label className="flex h-9 items-center gap-2 text-sm text-foreground">
            <Checkbox
              checked={payUpkeep}
              disabled={isFinalized}
              onChange={(event) => onTogglePayUpkeep(event.target.checked)}
            />
            Pay upkeep
          </label>
        </div>
      </div>
    </PostbattleSection>
  );
}
