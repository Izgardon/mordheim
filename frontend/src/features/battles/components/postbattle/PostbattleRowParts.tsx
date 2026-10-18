import { Button } from "@/components/ui/button";
import PostbattleInjuryResult from "@/features/battles/components/postbattle/PostbattleInjuryResult";
import PostbattleKeepStatsTick, {
  statChanges,
} from "@/features/battles/components/postbattle/PostbattleKeepStatsTick";
import PostbattleKillsControl from "@/features/battles/components/postbattle/PostbattleKillsControl";
import type { PostbattleRenderableRow } from "@/features/battles/components/postbattle/postbattle-utils";
import type { PostbattleRowTools } from "@/features/battles/components/postbattle/postbattle-row-tools";
import { liveKillEvents } from "@/features/battles/utils/battle-events";
import { cn } from "@/lib/utils";

/** A unit's kills: the live kill events, Plus to add one, Minus to undo the latest (BUG-11). */
export function PostbattleRowKills({
  row,
  tools,
}: {
  row: PostbattleRenderableRow;
  tools: PostbattleRowTools;
}) {
  return (
    <PostbattleKillsControl
      unitKey={row.unitKey}
      unitName={row.unitName}
      unitKind={row.unitKind}
      kills={liveKillEvents(tools.events, row.unitKey, tools.userId)}
      killTargetOptions={tools.actions.killTargetOptions}
      disabled={tools.isFinalized}
      onAddKill={tools.actions.addKill}
      onUndoKill={tools.actions.undoKill}
    />
  );
}

/** "Keep" for battle stat changes (SEC-10, decision 6); one tick for a henchmen group. */
export function PostbattleRowKeepStats({
  unitKeys,
  unitName,
  tools,
}: {
  unitKeys: string[];
  unitName: string;
  tools: PostbattleRowTools;
}) {
  const changesOf = (unitKey: string) =>
    statChanges(tools.baseStatsByUnitKey[unitKey], tools.unitInformation[unitKey]?.stats_override);
  const changedKey = unitKeys.find((unitKey) => changesOf(unitKey).length > 0);
  const { draft } = tools;
  if (!changedKey || !draft) {
    return null;
  }
  return (
    <PostbattleKeepStatsTick
      unitName={unitName}
      changes={changesOf(changedKey)}
      checked={unitKeys.some((unitKey) => draft.unit_results[unitKey]?.keep_stats)}
      disabled={tools.isFinalized}
      onChange={(keep) => tools.actions.toggleKeepStats(unitKeys, keep)}
    />
  );
}

/**
 * A unit's serious-injury rolls (BUG-47, decision 7): only the last counts; its server effect is
 * applied at finalise when ticked, or flagged to apply by hand.
 */
export function PostbattleRowInjuries({
  row,
  className,
  tools,
}: {
  row: PostbattleRenderableRow;
  className?: string;
  tools: PostbattleRowTools;
}) {
  if (row.seriousInjuryRolls.length === 0 || !tools.draft) {
    return null;
  }
  const lastIndex = row.seriousInjuryRolls.length - 1;
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap gap-2">
        {row.seriousInjuryRolls.map((roll, index) => (
          <div
            key={`${row.unitKey}-roll-${index}`}
            className={cn(
              "battle-chip px-3 py-1 text-xs text-muted-foreground",
              index < lastIndex && "line-through opacity-60"
            )}
            title={index < lastIndex ? "Re-rolled" : undefined}
          >
            {`${roll.roll_type.toUpperCase()} ${roll.result_code}: ${roll.result_label}`}
          </div>
        ))}
      </div>
      <PostbattleInjuryResult
        unitName={row.unitName}
        roll={row.seriousInjuryRolls[lastIndex]}
        disabled={tools.isFinalized}
        onToggleApply={(apply) => tools.actions.toggleInjuryApply(row, apply)}
      />
    </div>
  );
}

/** Opens the serious-injury roll for a unit taken out of action. */
export function PostbattleInjuryRollButton({
  row,
  tools,
}: {
  row: PostbattleRenderableRow;
  tools: PostbattleRowTools;
}) {
  if (!row.outOfAction) {
    return null;
  }
  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      className="h-9"
      disabled={tools.isFinalized}
      onClick={() =>
        tools.actions.setRollTarget({
          unitKey: row.unitKey,
          unitName: row.unitName,
          unitKind: row.unitKind,
        })
      }
    >
      Serious Injury Roll
    </Button>
  );
}
