import PostbattleDeadTick from "@/features/battles/components/postbattle/PostbattleDeadTick";
import {
  PostbattleInjuryRollButton,
  PostbattleRowInjuries,
  PostbattleRowKills,
} from "@/features/battles/components/postbattle/PostbattleRowParts";
import { PostbattleXpField } from "@/features/battles/components/postbattle/UnitResultCard";
import type { PostbattleRowTools } from "@/features/battles/components/postbattle/postbattle-row-tools";
import type { PostbattleRenderableGroup } from "@/features/battles/components/postbattle/postbattle-utils";

/** A henchmen group's results: one XP for the group, then each member's kills, Dead and injuries. */
export default function HenchmenGroupResult({
  group,
  tools,
}: {
  group: PostbattleRenderableGroup;
  tools: PostbattleRowTools;
}) {
  const firstRow = group.rows[0];
  return (
    <div className="battle-inline-panel p-3">
      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 pb-2">
            <p className="font-semibold text-foreground">{group.label}</p>
            <p className="text-xs text-muted-foreground">{firstRow?.unitType ?? "Henchmen"}</p>
          </div>
          {firstRow && firstRow.canGainXp ? (
            <PostbattleXpField
              value={firstRow.xpEarned}
              disabled={tools.isFinalized}
              onCommit={(nextXp) => tools.actions.commitGroupXp(group.label, nextXp)}
              unitName={group.label}
              suggested={tools.suggestion?.unit_results[firstRow.unitKey]}
            />
          ) : null}
        </div>
        <div className="space-y-3 border-t border-border/40 pt-3">
          {group.rows.map((row, index) => (
            <div key={row.unitKey} className={index > 0 ? "border-t border-border/40 pt-3" : ""}>
              <div className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="font-semibold text-foreground">{row.unitName}</p>
                  <div className="flex flex-wrap items-center gap-3">
                    <PostbattleInjuryRollButton row={row} tools={tools} />
                    <PostbattleDeadTick
                      unitKey={row.unitKey}
                      unitKind={row.unitKind}
                      checked={row.dead}
                      disabled={tools.isFinalized}
                      onChange={(checked) => void tools.actions.toggleDead(row, checked)}
                    />
                  </div>
                </div>
                <PostbattleRowKills row={row} tools={tools} />
                <PostbattleRowInjuries row={row} tools={tools} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
