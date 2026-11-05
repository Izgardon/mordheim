import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import type {
  ParticipantRoster,
  PrebattleUnit,
  UnitOverride,
} from "@/features/battles/components/prebattle/prebattle-types";
import type { PrebattleConfig } from "@/features/battles/hooks/usePrebattleConfig";
import type { PrebattleRolls } from "@/features/battles/hooks/usePrebattleRolls";
import {
  groupRolls,
  unitRolls,
  type PrebattleRollLine,
} from "@/features/battles/utils/prebattle-rolls";

import PrebattleRollLines from "./PrebattleRollLines";
import PrebattleUnitRow from "./PrebattleUnitRow";

type PrebattleUnitsProps = {
  roster: ParticipantRoster;
  customUnits: PrebattleUnit[];
  selectedKeys: string[];
  overrides: Record<string, UnitOverride>;
  /** Your own form while you may change it; read-only otherwise (another player's, or once ready). */
  config?: PrebattleConfig;
  /** Your own warband's rolls before the battle, shown under each unit making one. */
  rolls?: PrebattleRolls;
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col">
      <h3 className="m-0 pb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-faint">
        {title}
      </h3>
      <ul className="m-0 list-none p-0">{children}</ul>
    </section>
  );
}

/**
 * The units a warband brings: its heroes, henchmen (each member picked on its own,
 * or the group at once), hired swords, pets that fight and temporary units. Your own while you may
 * still change them; a unit missing games starts unpicked, as today. Your own show the rolls they
 * make before the battle (`rolls`): a hero's or hired sword's under his row, a group's once.
 */
export default function PrebattleUnits({
  roster,
  customUnits,
  selectedKeys,
  overrides,
  config,
  rolls,
}: PrebattleUnitsProps) {
  const picked = new Set(selectedKeys);
  const editable = config;
  const visible = (unit: PrebattleUnit) => Boolean(editable) || picked.has(unit.key);
  const rollLines = (lines: PrebattleRollLine[], owner: string, className?: string) =>
    rolls && lines.length ? (
      <PrebattleRollLines lines={lines} owner={owner} rolls={rolls} className={className} />
    ) : undefined;
  const row = (unit: PrebattleUnit, detail?: string, onRemove?: () => void) => (
    <PrebattleUnitRow
      key={unit.key}
      unit={unit}
      picked={picked.has(unit.key)}
      override={overrides[unit.key]}
      config={editable}
      detail={detail}
      onRemove={onRemove}
      rolls={
        unit.kind === "hero" || unit.kind === "hireling"
          ? rollLines(unitRolls(unit), unit.key)
          : undefined
      }
    />
  );
  const heroes = roster.heroes.filter(visible);
  const swords = roster.hirelings.filter(visible);
  const pets = (roster.petModels ?? []).filter(visible);
  const temporary = customUnits.filter(visible);
  const groups = roster.henchmenGroups
    .map((group) => ({ group, members: group.members.filter(visible) }))
    .filter((entry) => entry.members.length > 0);
  if (!heroes.length && !swords.length && !pets.length && !temporary.length && !groups.length) {
    return <p className="m-0 text-sm text-muted-foreground">No units picked yet.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {heroes.length ? <Section title="Heroes">{heroes.map((unit) => row(unit))}</Section> : null}
      {groups.length ? (
        <Section title="Henchmen">
          {groups.map(({ group, members }) => {
            const all = members.every((member) => picked.has(member.key));
            return (
              <li key={group.id} className="flex flex-col border-t border-line pt-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-baseline gap-2">
                    <span className="font-display text-[15px] font-semibold text-head">
                      {group.name}
                    </span>
                    <span className="font-mono text-xs text-accent-text">
                      ×{members.filter((member) => picked.has(member.key)).length}
                    </span>
                    <span className="text-xs text-muted-foreground">{group.unitType}</span>
                  </span>
                  {editable ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        members
                          .filter((member) => picked.has(member.key) === all)
                          .forEach((member) => editable.toggleUnitSelection(member.key))
                      }
                    >
                      {all ? "Leave all" : "Bring all"}
                    </Button>
                  ) : null}
                </div>
                {rollLines(groupRolls(members), `group:${group.id}`, "pb-1 pl-2 pt-1")}
                <ul className="m-0 list-none p-0 pl-2">{members.map((member) => row(member))}</ul>
              </li>
            );
          })}
        </Section>
      ) : null}
      {swords.length ? (
        <Section title="Hired swords">{swords.map((unit) => row(unit))}</Section>
      ) : null}
      {pets.length ? <Section title="Pets">{pets.map((unit) => row(unit, "Pet"))}</Section> : null}
      {temporary.length ? (
        <Section title="Temporary units">
          {temporary.map((unit) =>
            row(
              unit,
              unit.rating ? `rating ${unit.rating}` : undefined,
              editable ? () => editable.removeCustomUnit(unit.key) : undefined
            )
          )}
        </Section>
      ) : null}
    </div>
  );
}
