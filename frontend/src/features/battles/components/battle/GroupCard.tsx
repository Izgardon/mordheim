import { StatStrip } from "@/components/ui/stat-strip";
import { cn } from "@/lib/utils";

import {
  STATUS_LABEL,
  statValues,
  type BattleGroupView,
  type BattleUnitView,
} from "./battle-units";
import {
  KillButton,
  NotePreview,
  QuickRow,
  STATUS_TONE,
  WoundsControl,
  type GearTab,
} from "./UnitCardParts";

/**
 * What a group card may do. Left out for another warband's group: everything about it is visible,
 * nothing is editable (William, 12 Nov 2026).
 */
export type GroupCardActions = {
  canAct: boolean;
  savingKeys: Record<string, boolean>;
  onKill: () => void;
  onCycle: (memberKey: string) => void;
  /** A model's wounds, shared like a hero's: one lost (-1) or healed (+1). */
  onWounds: (memberKey: string, delta: number) => void;
  /** Opens the group's battle note, kept on one model (the first with a note, else the first). */
  onNote: (memberKey: string) => void;
};

type GroupCardProps = {
  entry: BattleGroupView;
  /** The members whose status changed a moment ago: their tiles are marked briefly. */
  recentKeys?: ReadonlySet<string>;
  onOpen: (tab: GearTab) => void;
  actions?: GroupCardActions;
};

/** A model's lines inside its tile: its name, status, kills and the loadout rows it lacks. */
function MemberLines({ member }: { member: BattleUnitView }) {
  return (
    <>
      <span className="truncate text-[13px] font-bold text-ink">{member.unit.displayName}</span>
      <span className="text-[11px]">{STATUS_LABEL[member.status]}</span>
      <span className="text-[11px] text-muted-foreground">
        {member.kills === 1 ? "1 kill" : `${member.kills} kills`}
      </span>
      {member.unit.gaps?.length ? (
        <span className="truncate text-[11px] text-danger">
          No {member.unit.gaps.map((gap) => gap.name).join(", ")}
        </span>
      ) : null}
    </>
  );
}

const TILE = "flex min-h-14 flex-col gap-px px-2 py-1.5 text-left text-ink";

/**
 * A henchmen group in the fight (design E): its name and count, one kill button (the sheet asks
 * which model), its profile, Gear, and a tile per model whose status cycles on a tap, with its
 * kills and its wounds (− and +, shared like a hero's). A kill is logged against the model.
 *
 * Another warband's group (no `actions`) shows the same profile, gear, rules and tiles, each
 * model's wounds as text and nothing that changes anything.
 *
 * A member in `recentKeys` wears a brief mark on his tile, which is both the model and the card's
 * section holding his status (William, 12 Nov 2026).
 */
export default function GroupCard({ entry, recentKeys, onOpen, actions }: GroupCardProps) {
  const { group, members } = entry;
  const kills = members.reduce((sum, member) => sum + member.kills, 0);
  const allOut = members.every((member) => member.status === "out_of_action");
  const first = members.find((member) => member.status !== "out_of_action") ?? members[0];
  // the group's note, as main's group card kept it: on the first model with a note, else the first
  const noted = members.find((member) => member.info?.notes?.trim()) ?? members[0];
  const note = noted?.info?.notes?.trim() ?? "";
  const onNote = actions && noted ? () => actions.onNote(noted.unit.key) : undefined;
  return (
    <article
      aria-label={group.name}
      className={cn(
        "flex flex-col gap-[9px] border bg-surface px-3 py-[11px]",
        allOut ? "border-danger-line" : "border-border"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <h3 className="m-0 font-display text-[17px] font-semibold text-head">{group.name}</h3>
          <span className="font-mono text-xs text-accent-text">×{members.length}</span>
          <span className="text-xs text-muted-foreground">{group.unitType}</span>
        </div>
        {actions ? (
          <KillButton
            name={`the ${group.name}`}
            kills={kills}
            disabled={!actions.canAct || allOut}
            onClick={actions.onKill}
          />
        ) : null}
      </div>
      {first && !allOut ? (
        <StatStrip
          values={statValues(first.stats, first.written)}
          highlighted={first.highlighted}
        />
      ) : null}
      {first ? (
        <QuickRow
          unit={first.unit}
          onOpen={onOpen}
          hideEmpty
          note={onNote ? { text: note, onOpen: onNote } : undefined}
        />
      ) : null}
      {note && onNote ? <NotePreview text={note} onOpen={onNote} /> : null}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-1.5">
        {members.map((member) => (
          <div
            key={member.unit.key}
            className={cn(
              "flex flex-col border",
              STATUS_TONE[member.status],
              recentKeys?.has(member.unit.key) && "status-flash"
            )}
          >
            {actions ? (
              <button
                type="button"
                aria-label={`${member.unit.displayName}: ${STATUS_LABEL[member.status]}. Tap for the next`}
                disabled={!actions.canAct || Boolean(actions.savingKeys[member.unit.key])}
                onClick={() => actions.onCycle(member.unit.key)}
                className={cn(TILE, "disabled:opacity-60")}
              >
                <MemberLines member={member} />
              </button>
            ) : (
              <div className={TILE}>
                <MemberLines member={member} />
              </div>
            )}
            <div className="px-1 pb-1">
              {actions ? (
                <WoundsControl
                  compact
                  name={member.unit.displayName}
                  wounds={member.wounds}
                  max={member.maxWounds}
                  disabled={
                    !actions.canAct ||
                    Boolean(actions.savingKeys[member.unit.key]) ||
                    member.status === "out_of_action"
                  }
                  onChange={(delta) => actions.onWounds(member.unit.key, delta)}
                />
              ) : (
                <span className="block text-center font-mono text-[11px] font-bold text-ink">
                  {member.wounds}/{member.maxWounds}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
