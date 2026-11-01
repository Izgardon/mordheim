import type { ParticipantRoster } from "@/features/battles/components/prebattle/prebattle-types";
import type { BattleNeutralGroup } from "@/features/battles/types/battle-types";
import { cn } from "@/lib/utils";

import {
  battleSections,
  nextStatus,
  STATUS_LABEL,
  type UnitStatus,
  type WarbandSide,
} from "./battle-units";
import { StatusButton, STATUS_TONE, WoundsControl } from "./UnitCardParts";

function Row({
  name,
  detail,
  status,
  wounds,
}: {
  name: string;
  detail: string;
  status: UnitStatus;
  wounds?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2.5 border border-border bg-surface px-3 py-2.5">
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-display text-[15px] font-semibold text-head">{name}</span>
        <span className="text-xs text-muted-foreground">{detail}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {wounds ? <span className="font-mono text-xs text-text2">{wounds}</span> : null}
        <span className={cn("border px-2 py-0.5 text-[11px] font-bold", STATUS_TONE[status])}>
          {STATUS_LABEL[status]}
        </span>
      </div>
    </div>
  );
}

/**
 * Another warband's units, view only (design E): its heroes, hired swords and the rest with their
 * status, and each henchmen group as one row with how many are out.
 */
export function OtherWarband({
  side,
  roster,
}: {
  side: WarbandSide;
  roster: ParticipantRoster | undefined;
}) {
  const sections = battleSections(side.participant, roster);
  const singles = [
    ...sections.heroes.map((view) => ({ view, kind: "hero" })),
    ...sections.swords.map((view) => ({ view, kind: "hired sword" })),
    ...sections.pets.map((view) => ({ view, kind: "animal" })),
    ...sections.temporary.map((view) => ({ view, kind: "temporary" })),
  ];
  if (!roster) return <p className="m-0 text-sm text-muted-foreground">Reading their roster…</p>;
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-muted-foreground">
        {side.participant.user.label}&rsquo;s warband · view only
      </span>
      {singles.map(({ view, kind }) => (
        <Row
          key={view.unit.key}
          name={view.unit.displayName}
          detail={`${view.unit.unitType} · ${kind}${view.kills ? ` · ${view.kills} kills` : ""}`}
          status={view.status}
          wounds={
            view.status === "out_of_action" ? undefined : `W ${view.wounds}/${view.maxWounds}`
          }
        />
      ))}
      {sections.groups.map(({ group, members }) => {
        const out = members.filter((member) => member.status === "out_of_action").length;
        const down = members.find(
          (member) => member.status !== "standing" && member.status !== "out_of_action"
        );
        return (
          <Row
            key={group.id}
            name={`${group.name} ×${members.length}`}
            detail={`Henchmen · ${out} out`}
            status={out === members.length ? "out_of_action" : (down?.status ?? "standing")}
          />
        );
      })}
      {singles.length === 0 && sections.groups.length === 0 ? (
        <p className="m-0 text-sm text-muted-foreground">No units in this battle.</p>
      ) : null}
    </div>
  );
}

/**
 * A neutral group (design E): creatures nobody plays. Anyone in the fight tracks each one's status
 * and wounds, adds another, or takes the group away; they can be kill victims.
 */
export function NeutralGroupUnits({
  group,
  canAct,
  onCycle,
  onWounds,
  onAdd,
  onRemove,
}: {
  group: BattleNeutralGroup;
  canAct: boolean;
  onCycle: (key: string, next: UnitStatus) => void;
  onWounds: (key: string, wounds: number) => void;
  onAdd: () => void;
  onRemove: () => void;
}) {
  const max = group.max_wounds ?? group.stats?.wounds ?? 1;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2.5">
        <span className="text-xs text-muted-foreground">Neutral group · {group.creature_type}</span>
        {canAct ? (
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={onRemove}
              className="min-h-10 px-3 text-xs font-bold text-danger"
            >
              Remove group
            </button>
            <button
              type="button"
              onClick={onAdd}
              className="min-h-10 border border-dashed border-strong px-3 text-xs font-bold text-accent-text"
            >
              Add a unit
            </button>
          </div>
        ) : null}
      </div>
      {group.creatures.map((creature) => (
        <div
          key={creature.key}
          className="flex flex-col gap-2 border border-border bg-surface px-3 py-2.5"
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-display text-[15px] font-semibold text-head">
              {creature.name}
            </span>
            <span className="text-xs text-muted-foreground">Neutral</span>
          </div>
          <div className="flex items-center gap-1.5">
            <StatusButton
              name={creature.name}
              status={creature.status}
              disabled={!canAct}
              onClick={() => onCycle(creature.key, nextStatus(creature.status))}
            />
            <WoundsControl
              name={creature.name}
              wounds={creature.wounds}
              max={Math.max(max, creature.wounds)}
              disabled={!canAct || creature.status === "out_of_action"}
              onChange={(delta) => onWounds(creature.key, creature.wounds + delta)}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
