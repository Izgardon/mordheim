import { useEffect, useState } from "react";

import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { ModalSheet } from "@/components/ui/modal-sheet";
import type { UnitStats } from "@/features/battles/components/prebattle/prebattle-types";
import {
  CRITICAL_HIT_TABLES,
  MELEE_CRITICAL_TABLES,
  RANGED_CRITICAL_TABLES,
} from "@/features/battles/data/critical-hits";

import {
  formatToHit,
  meleeToHit,
  RANGED_MODIFIERS,
  rangedToHit,
  saveAfter,
  saveModifier,
  toWound,
} from "./combat-helpers";

/** A model the helpers can read a profile from. */
export type CombatOption = { key: string; name: string; stats: Partial<UnitStats> };

type CombatSheetProps = {
  kind: "melee" | "ranged" | null;
  yours: CombatOption[];
  theirs: CombatOption[];
  onOpenChange: (open: boolean) => void;
};

type Numbers = { skill: string; strength: string; toughness: string; save: string };

const num = (value: string) => Number.parseInt(value, 10) || 0;
const text = (value: number | null | undefined) => (typeof value === "number" ? String(value) : "");

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col items-center gap-1 text-[10px] font-bold text-faint">
      {label}
      <Input
        inputSize="sm"
        inputMode="numeric"
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/[^\d]/g, "").slice(0, 2))}
        className="w-14 px-1 text-center font-mono"
      />
    </label>
  );
}

function Picker({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: CombatOption[];
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-bold text-text2">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 min-w-0 border border-strong bg-page px-2 text-sm text-ink"
      >
        <option value="">Type the numbers</option>
        {options.map((option) => (
          <option key={option.key} value={option.key}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function Result({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 border border-accent-line bg-surface px-2 py-2.5">
      <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-faint">{label}</span>
      <span className="font-display text-[22px] font-semibold text-accent-hi">{value}</span>
    </div>
  );
}

/**
 * Melee and Ranged (design E): pick your model and theirs (or type the numbers) for the roll to
 * hit, to wound and the save left; the critical hit tables sit underneath.
 */
export default function CombatSheet({ kind, yours, theirs, onOpenChange }: CombatSheetProps) {
  const [mineKey, setMineKey] = useState("");
  const [theirKey, setTheirKey] = useState("");
  const [mine, setMine] = useState<Numbers>({
    skill: "3",
    strength: "3",
    toughness: "3",
    save: "",
  });
  const [their, setTheir] = useState<Numbers>({
    skill: "3",
    strength: "3",
    toughness: "3",
    save: "",
  });
  const [modifiers, setModifiers] = useState<string[]>([]);
  useEffect(() => setModifiers([]), [kind]);

  const fromStats = (
    stats: Partial<UnitStats>,
    skill: "weapon_skill" | "ballistic_skill"
  ): Numbers => ({
    skill: text(stats[skill]),
    strength: text(stats.strength),
    toughness: text(stats.toughness),
    save: text(stats.armour_save),
  });
  const skillKey = kind === "ranged" ? "ballistic_skill" : "weapon_skill";
  const pickMine = (key: string) => {
    setMineKey(key);
    const option = yours.find((entry) => entry.key === key);
    if (option) setMine(fromStats(option.stats, skillKey));
  };
  const pickTheirs = (key: string) => {
    setTheirKey(key);
    const option = theirs.find((entry) => entry.key === key);
    if (option) setTheir(fromStats(option.stats, "weapon_skill"));
  };

  const modifier = RANGED_MODIFIERS.filter((entry) => modifiers.includes(entry.id)).reduce(
    (sum, entry) => sum + entry.value,
    0
  );
  const hit =
    kind === "ranged"
      ? formatToHit(rangedToHit(num(mine.skill), modifier))
      : formatToHit(meleeToHit(num(mine.skill), num(their.skill)));
  const wound = toWound(num(mine.strength), num(their.toughness));
  const save = saveAfter(their.save ? num(their.save) : null, num(mine.strength));
  const tables = CRITICAL_HIT_TABLES.filter((table) =>
    (kind === "ranged" ? RANGED_CRITICAL_TABLES : MELEE_CRITICAL_TABLES).includes(table.id)
  );

  return (
    <ModalSheet
      open={kind !== null}
      onOpenChange={onOpenChange}
      kicker="To hit, to wound, crits"
      title={kind === "ranged" ? "Ranged" : "Melee"}
    >
      <div className="flex flex-wrap items-end gap-3">
        <Picker label="Yours" options={yours} value={mineKey} onChange={pickMine} />
        <div className="flex gap-1.5">
          <Field
            label={kind === "ranged" ? "BS" : "WS"}
            value={mine.skill}
            onChange={(skill) => setMine({ ...mine, skill })}
          />
          <Field
            label="S"
            value={mine.strength}
            onChange={(strength) => setMine({ ...mine, strength })}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Picker label="Theirs" options={theirs} value={theirKey} onChange={pickTheirs} />
        <div className="flex gap-1.5">
          {kind === "melee" ? (
            <Field
              label="WS"
              value={their.skill}
              onChange={(skill) => setTheir({ ...their, skill })}
            />
          ) : null}
          <Field
            label="T"
            value={their.toughness}
            onChange={(toughness) => setTheir({ ...their, toughness })}
          />
          <Field
            label="Sv"
            value={their.save}
            onChange={(value) => setTheir({ ...their, save: value })}
          />
        </div>
      </div>
      {kind === "ranged" ? (
        <div role="group" aria-label="Modifiers" className="flex flex-wrap gap-1.5">
          {RANGED_MODIFIERS.map((entry) => {
            const on = modifiers.includes(entry.id);
            return (
              <Chip
                key={entry.id}
                pressed={on}
                onClick={() =>
                  setModifiers(
                    on ? modifiers.filter((id) => id !== entry.id) : [...modifiers, entry.id]
                  )
                }
              >
                {entry.label} {entry.value > 0 ? "+1" : "−1"}
              </Chip>
            );
          })}
        </div>
      ) : null}
      <div className="grid grid-cols-3 gap-1.5">
        <Result label="To hit" value={hit} />
        <Result label="To wound" value={wound === null ? "–" : `${wound}+`} />
        <Result label="Their save" value={save === null ? "None" : `${save}+`} />
      </div>
      <p className="m-0 text-xs text-muted-foreground">
        Strength {num(mine.strength) || "–"} takes {saveModifier(num(mine.strength))} off the save.
      </p>
      {tables.map((table) => (
        <section key={table.id} aria-label={table.label} className="flex flex-col">
          <h3 className="m-0 pb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-faint">
            Critical hits · {table.label}
          </h3>
          <dl className="m-0 flex flex-col">
            {table.entries.map((entry) => (
              <div
                key={entry.roll}
                className="grid grid-cols-[3rem_minmax(0,1fr)] gap-3 border-t border-line py-2"
              >
                <dt className="font-mono text-sm font-bold text-accent-text">{entry.roll}</dt>
                <dd className="m-0 text-sm text-text2">{entry.result}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </ModalSheet>
  );
}
