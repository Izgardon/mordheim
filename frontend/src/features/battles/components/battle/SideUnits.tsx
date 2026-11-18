import type {
  ParticipantRoster,
  PrebattleUnit,
} from "@/features/battles/components/prebattle/prebattle-types";
import type { BattleNeutralGroup } from "@/features/battles/types/battle-types";

import {
  allViews,
  battleSections,
  nextStatus,
  type UnitStatus,
  type WarbandSide,
} from "./battle-units";
import { StatusButton, WoundsControl, type GearTab } from "./UnitCardParts";
import WarbandUnits from "./WarbandUnits";

/**
 * Another warband's units (William, 12 Nov 2026): the same cards your own side shows — profile,
 * mount, gear, skills, spells and rules — with no control that changes anything.
 */
export function OtherWarband({
  side,
  roster,
  isMobile,
  onOpen,
}: {
  side: WarbandSide;
  roster: ParticipantRoster | undefined;
  isMobile: boolean;
  onOpen: (unit: PrebattleUnit, tab: GearTab) => void;
}) {
  if (!roster) return <p className="m-0 text-sm text-muted-foreground">Reading their roster…</p>;
  const sections = battleSections(side.participant, roster);
  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-xs text-muted-foreground">
        {side.participant.user.label}&rsquo;s warband · view only
      </span>
      {allViews(sections).length === 0 ? (
        <p className="m-0 text-sm text-muted-foreground">No units in this battle.</p>
      ) : (
        <WarbandUnits sections={sections} isMobile={isMobile} onOpen={onOpen} />
      )}
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
