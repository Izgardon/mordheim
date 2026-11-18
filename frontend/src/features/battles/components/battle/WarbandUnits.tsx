import type { PrebattleUnit } from "@/features/battles/components/prebattle/prebattle-types";
import { cn } from "@/lib/utils";

import { canScore, distinctType, type BattleSections, type BattleUnitView } from "./battle-units";
import GroupCard from "./GroupCard";
import UnitCard from "./UnitCard";
import type { GearTab } from "./UnitCardParts";

const TYPE_SUFFIX: Record<string, string> = {
  hireling: "hired sword",
  pet: "animal",
  custom: "temporary",
};

/**
 * What the cards of a warband's side may do. Left out for another warband's: its units show
 * everything yours do and nothing changes them (William, 12 Nov 2026).
 */
export type WarbandUnitActions = {
  canAct: boolean;
  savingKeys: Record<string, boolean>;
  onKill: (name: string, models: BattleUnitView[]) => void;
  onStatus: (view: BattleUnitView) => void;
  onWounds: (unit: PrebattleUnit, delta: number) => void;
  onDismount: (unitKey: string, dismounted: boolean) => void;
  onNote: (view: BattleUnitView, name?: string) => void;
  onAdd: () => void;
};

/**
 * One warband's units in the fight: its heroes, hired swords, animals, henchmen groups and
 * temporary units as cards, and Add a unit at the end of your own.
 */
export default function WarbandUnits({
  sections,
  isMobile,
  onOpen,
  actions,
}: {
  sections: BattleSections;
  isMobile: boolean;
  onOpen: (unit: PrebattleUnit, tab: GearTab) => void;
  actions?: WarbandUnitActions;
}) {
  const card = (view: BattleUnitView) => (
    <UnitCard
      key={view.unit.key}
      view={view}
      typeLine={[distinctType(view.unit), TYPE_SUFFIX[view.unit.kind]].filter(Boolean).join(" · ")}
      onOpen={(tab) => onOpen(view.unit, tab)}
      actions={
        actions && {
          canAct: actions.canAct,
          saving: Boolean(actions.savingKeys[view.unit.key]),
          onKill: canScore(view.unit)
            ? () => actions.onKill(view.unit.displayName, [view])
            : undefined,
          onCycle: () => actions.onStatus(view),
          onWounds: (delta) => actions.onWounds(view.unit, delta),
          onDismount: (dismounted) => actions.onDismount(view.unit.key, dismounted),
          onNote: () => actions.onNote(view),
        }
      }
    />
  );
  return (
    <div
      className={cn(
        "grid gap-2.5",
        isMobile ? "" : "grid-cols-[repeat(auto-fill,minmax(320px,1fr))]"
      )}
    >
      {sections.heroes.map(card)}
      {sections.swords.map(card)}
      {sections.pets.map(card)}
      {sections.groups.map((entry) => (
        <GroupCard
          key={entry.group.id}
          entry={entry}
          onOpen={(tab) => onOpen(entry.members[0].unit, tab)}
          actions={
            actions && {
              canAct: actions.canAct,
              savingKeys: actions.savingKeys,
              onKill: () => actions.onKill(entry.group.name, entry.members),
              onCycle: (key) => {
                const member = entry.members.find((candidate) => candidate.unit.key === key);
                if (member) actions.onStatus(member);
              },
              onWounds: (key, delta) => {
                const member = entry.members.find((candidate) => candidate.unit.key === key);
                if (member) actions.onWounds(member.unit, delta);
              },
              onNote: (key) => {
                const member = entry.members.find((candidate) => candidate.unit.key === key);
                if (member) actions.onNote(member, entry.group.name);
              },
            }
          }
        />
      ))}
      {sections.temporary.map(card)}
      {actions?.canAct ? (
        <button
          type="button"
          onClick={actions.onAdd}
          className="col-span-full min-h-12 border border-dashed border-strong text-[13px] font-bold text-accent-text"
        >
          Add a unit
        </button>
      ) : null}
    </div>
  );
}
