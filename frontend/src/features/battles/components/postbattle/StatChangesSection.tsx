import { Checkbox } from "@/components/ui/checkbox";
import PostbattleSection, {
  POSTBATTLE_SECTION_LABELS,
} from "@/features/battles/components/postbattle/PostbattleSection";
import type { StatChangeRow } from "@/features/battles/components/postbattle/stat-changes";

/**
 * Stat changes: every unit the battle changed the stats of, each with a Keep tick, off by
 * default (BATL-TWEAK-04, decision 6). Kept changes become permanent at finalise and are logged;
 * the rest end with the battle. One tick keeps a henchmen group's.
 */
export default function StatChangesSection({
  isMobile,
  rows,
  isFinalized,
  onToggleKeep,
}: {
  isMobile: boolean;
  rows: StatChangeRow[];
  isFinalized: boolean;
  onToggleKeep: (unitKeys: string[], keep: boolean) => void;
}) {
  if (rows.length === 0) {
    return null;
  }
  return (
    <PostbattleSection
      section="stats"
      isMobile={isMobile}
      className={isMobile ? "battle-mobile-section-divider" : undefined}
    >
      <div className="space-y-1">
        <p className="battle-section-title">{POSTBATTLE_SECTION_LABELS.stats}</p>
        <p className="text-xs text-muted-foreground">
          Battle stat changes end with the battle unless you keep them.
        </p>
      </div>
      <ul className="space-y-2" aria-label="Units with stat changes">
        {rows.map((row) => (
          <li
            key={row.key}
            className="battle-inline-panel flex flex-wrap items-center justify-between gap-2 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="font-semibold text-foreground">{row.unitName}</p>
              <p className="text-xs text-muted-foreground">{row.changes.join(", ")}</p>
            </div>
            <label className="flex h-11 items-center gap-2 text-sm text-foreground">
              <Checkbox
                checked={row.kept}
                disabled={isFinalized}
                aria-label={`Keep ${row.unitName}'s stat changes`}
                onChange={(event) => onToggleKeep(row.unitKeys, event.target.checked)}
              />
              Keep
            </label>
          </li>
        ))}
      </ul>
    </PostbattleSection>
  );
}
