import type { ReactNode } from "react";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ChipLabel } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { StatStrip } from "@/components/ui/stat-strip";
import {
  STAT_FIELDS,
  type ParticipantRoster,
  type PrebattleUnit,
  type UnitOverride,
} from "@/features/battles/components/prebattle/prebattle-types";
import type { PrebattleConfig } from "@/features/battles/hooks/usePrebattleConfig";
import { cn } from "@/lib/utils";

import { statValues } from "../battle/battle-units";

type PrebattleUnitsProps = {
  roster: ParticipantRoster;
  customUnits: PrebattleUnit[];
  selectedKeys: string[];
  overrides: Record<string, UnitOverride>;
  /** Your own form while you may change it; read-only otherwise (another player's, or once ready). */
  config?: PrebattleConfig;
};

const missingLabel = (unit: { missingGames?: number }) =>
  unit.missingGames
    ? `Missing · ${unit.missingGames} game${unit.missingGames === 1 ? "" : "s"}`
    : "";

/** A square tick: picked or not. */
function Tick({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center border-2",
        on ? "border-primary bg-primary text-on-accent" : "border-strong bg-transparent"
      )}
    >
      {on ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
    </span>
  );
}

function StatEditor({ unit, config }: { unit: PrebattleUnit; config: PrebattleConfig }) {
  const override = config.overrides[unit.key]?.stats ?? {};
  return (
    <div className="flex flex-col gap-2 border-t border-line pt-2">
      <div className="grid grid-cols-5 gap-1.5 min-[560px]:grid-cols-10">
        {STAT_FIELDS.map((field) => {
          const value = override[field.key] ?? unit.stats[field.key];
          return (
            <label
              key={field.key}
              className="flex flex-col items-center gap-1 text-[10px] font-bold text-faint"
            >
              {field.key === "armour_save" ? "Sv" : field.label}
              <Input
                inputSize="sm"
                inputMode="numeric"
                aria-label={`${unit.displayName} ${field.label}`}
                value={value === null || value === undefined ? "" : String(value)}
                onChange={(event) => config.updateOverrideStat(unit, field.key, event.target.value)}
                className="px-1 text-center font-mono"
              />
            </label>
          );
        })}
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={() => config.clearUnitOverride(unit.key)}>
          Reset to the roster
        </Button>
        <Button variant="secondary" size="sm" onClick={() => config.toggleEditingUnit(unit.key)}>
          Done
        </Button>
      </div>
    </div>
  );
}

function UnitRow({
  unit,
  picked,
  override,
  config,
  detail,
  onRemove,
}: {
  unit: PrebattleUnit;
  picked: boolean;
  override?: UnitOverride;
  config?: PrebattleConfig;
  detail?: string;
  onRemove?: () => void;
}) {
  const editing = config?.editingUnitKey === unit.key;
  const stats = { ...unit.stats, ...(override?.stats ?? {}) };
  const changed = Object.keys(override?.stats ?? {}) as (keyof typeof stats)[];
  const missing = missingLabel(unit);
  return (
    <li className="flex flex-col gap-2 border-t border-line py-2.5">
      <div className="flex items-center gap-3">
        {config ? (
          <button
            type="button"
            role="checkbox"
            aria-checked={picked}
            aria-label={`Bring ${unit.displayName}`}
            onClick={() => config.toggleUnitSelection(unit.key)}
            className="flex min-h-11 min-w-11 items-center justify-center"
          >
            <Tick on={picked} />
          </button>
        ) : null}
        <span className={cn("flex min-w-0 flex-1 flex-col", !picked && "opacity-60")}>
          <span className="truncate font-display text-[15px] font-semibold text-head">
            {unit.displayName}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {[unit.unitType, detail].filter(Boolean).join(" · ")}
          </span>
        </span>
        {missing ? <ChipLabel tone="danger">{missing}</ChipLabel> : null}
        {changed.length ? <ChipLabel tone="accent">Stats changed</ChipLabel> : null}
        {config && picked && !editing ? (
          <Button variant="ghost" size="sm" onClick={() => config.toggleEditingUnit(unit.key)}>
            Edit stats
          </Button>
        ) : null}
        {onRemove ? (
          <Button variant="ghost" size="sm" className="text-danger" onClick={onRemove}>
            Remove
          </Button>
        ) : null}
      </div>
      {editing && config ? (
        <StatEditor unit={unit} config={config} />
      ) : picked && changed.length ? (
        <StatStrip values={statValues(stats)} highlighted={changed.map((key) => STAT_SHORT[key])} />
      ) : null}
    </li>
  );
}

const STAT_SHORT = {
  movement: "M",
  weapon_skill: "WS",
  ballistic_skill: "BS",
  strength: "S",
  toughness: "T",
  wounds: "W",
  initiative: "I",
  attacks: "A",
  leadership: "Ld",
  armour_save: "Sv",
} as const;

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
 * The units a warband brings (next step 6): its heroes, henchmen (each member picked on its own,
 * or the group at once), hired swords, pets that fight and temporary units. Your own while you may
 * still change them; a unit missing games starts unpicked, as today.
 */
export default function PrebattleUnits({
  roster,
  customUnits,
  selectedKeys,
  overrides,
  config,
}: PrebattleUnitsProps) {
  const picked = new Set(selectedKeys);
  const editable = config;
  const visible = (unit: PrebattleUnit) => Boolean(editable) || picked.has(unit.key);
  const row = (unit: PrebattleUnit, detail?: string, onRemove?: () => void) => (
    <UnitRow
      key={unit.key}
      unit={unit}
      picked={picked.has(unit.key)}
      override={overrides[unit.key]}
      config={editable}
      detail={detail}
      onRemove={onRemove}
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
