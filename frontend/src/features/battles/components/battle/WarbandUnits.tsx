import { Fragment, type ReactNode } from "react";

import type { PrebattleUnit } from "@/features/battles/components/prebattle/prebattle-types";
import { cn } from "@/lib/utils";

import {
  battleSectionLabel,
  canScore,
  distinctType,
  type BattleSections,
  type BattleUnitView,
} from "./battle-units";
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
 * temporary units as cards under a heading each (William, 12 Nov 2026: sectioned "by unit type"),
 * and Add a unit at the end of your own. An empty section has no heading.
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
  const groups: { kind: PrebattleUnit["kind"]; cards: ReactNode[] }[] = [
    { kind: "hero", cards: sections.heroes.map(card) },
    { kind: "hireling", cards: sections.swords.map(card) },
    { kind: "pet", cards: sections.pets.map(card) },
    {
      kind: "henchman",
      cards: sections.groups.map((entry) => (
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
      )),
    },
    { kind: "custom", cards: sections.temporary.map(card) },
  ];
  return (
    <div
      className={cn(
        "grid gap-2.5",
        isMobile ? "" : "grid-cols-[repeat(auto-fill,minmax(320px,1fr))]"
      )}
    >
      {groups
        .filter((section) => section.cards.length > 0)
        .map((section) => (
          <Fragment key={section.kind}>
            <h2 className="col-span-full m-0 text-[11px] font-bold uppercase tracking-[0.12em] text-faint">
              {battleSectionLabel({ kind: section.kind })}
            </h2>
            {section.cards}
          </Fragment>
        ))}
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
