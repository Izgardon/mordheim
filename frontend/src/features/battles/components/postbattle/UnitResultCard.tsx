import PostbattleDeadTick from "@/features/battles/components/postbattle/PostbattleDeadTick";
import {
  PostbattleInjuryRollButton,
  PostbattleRowInjuries,
  PostbattleRowKills,
} from "@/features/battles/components/postbattle/PostbattleRowParts";
import PostbattleStepperInput from "@/features/battles/components/postbattle/PostbattleStepperInput";
import type { PostbattleRowTools } from "@/features/battles/components/postbattle/postbattle-row-tools";
import type { PostbattleRenderableRow } from "@/features/battles/components/postbattle/postbattle-utils";
import XpReasons, { type XpReason } from "@/features/battles/components/postbattle/XpReasons";

/** An XP field committed on blur, with why the server suggests its value (BATL-NEW-09). */
export function PostbattleXpField({
  value,
  disabled,
  onCommit,
  unitName,
  suggested,
}: {
  value: number;
  disabled: boolean;
  onCommit: (xp: number) => void;
  unitName: string;
  suggested?: { xp_earned: number; reasons?: XpReason[] };
}) {
  return (
    <div className="flex items-end gap-1">
      <label className="space-y-1">
        <span className="block text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          XP
        </span>
        <PostbattleStepperInput value={value} min={0} disabled={disabled} onCommit={onCommit} />
      </label>
      <XpReasons
        unitName={unitName}
        xp={suggested?.xp_earned ?? value}
        reasons={suggested?.reasons}
      />
    </div>
  );
}

/** A hero's or hired sword's results: XP, Dead, kills and injuries. */
export default function UnitResultCard({
  row,
  tools,
}: {
  row: PostbattleRenderableRow;
  tools: PostbattleRowTools;
}) {
  return (
    <div
      className={`battle-card p-3 ${row.outOfAction ? "border-red-600/70" : "border-border/60"}`}
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-foreground">{row.unitName}</p>
            <p className="text-xs text-muted-foreground">{row.unitType}</p>
          </div>
          <PostbattleInjuryRollButton row={row} tools={tools} />
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          {row.canGainXp ? (
            <PostbattleXpField
              value={row.xpEarned}
              disabled={tools.isFinalized}
              onCommit={(nextXp) => tools.actions.commitUnitXp(row.unitKey, nextXp)}
              unitName={row.unitName}
              suggested={tools.suggestion?.unit_results[row.unitKey]}
            />
          ) : (
            <span />
          )}
          <PostbattleDeadTick
            unitKey={row.unitKey}
            unitKind={row.unitKind}
            checked={row.dead}
            disabled={tools.isFinalized}
            onChange={(checked) => void tools.actions.toggleDead(row, checked)}
          />
        </div>
        <PostbattleRowKills row={row} tools={tools} />
      </div>
      <PostbattleRowInjuries row={row} className="mt-3" tools={tools} />
    </div>
  );
}
