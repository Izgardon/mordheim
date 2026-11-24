import { useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";

import { NumberInput } from "@/components/ui/number-input";
import { Chip } from "@/components/ui/chip";
import { ModalSheet } from "@/components/ui/modal-sheet";
import type { UnitStats } from "@/features/battles/components/prebattle/prebattle-types";
import {
  CRITICAL_HIT_TABLES,
  MELEE_CRITICAL_TABLES,
  RANGED_CRITICAL_TABLES,
} from "@/features/battles/data/critical-hits";
import { MISFIRE_TABLE } from "@/features/battles/data/misfire";

import {
  formatToHit,
  meleeToHit,
  RANGED_MODIFIERS,
  rangedToHit,
  saveAfter,
  saveModifier,
  toWound,
} from "./combat-helpers";
import CombatPicker, { type CombatOption } from "./CombatPicker";
import CriticalTables from "./CriticalTables";

type CombatSheetProps = {
  kind: "melee" | "ranged" | null;
  yours: CombatOption[];
  theirs: CombatOption[];
  onOpenChange: (open: boolean) => void;
};

type Numbers = { skill: string; strength: string; toughness: string; save: string };

const num = (value: string) => Number.parseInt(value, 10) || 0;
const text = (value: number | null | undefined) => (typeof value === "number" ? String(value) : "");

/** One number, its name beside a box that fills the rest of its column; Theirs' name on the right. */
function Field({
  label,
  value,
  onChange,
  end = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  end?: boolean;
}) {
  const input = (
    <NumberInput
      inputSize="sm"
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value.replace(/[^\d]/g, "").slice(0, 2))}
      className="min-w-0 px-1 text-center font-mono"
    />
  );
  return (
    <label
      className={cn(
        "grid items-center gap-2 text-xs font-bold text-faint",
        end ? "grid-cols-[minmax(0,1fr)_1.75rem] text-right" : "grid-cols-[1.75rem_minmax(0,1fr)]"
      )}
    >
      {end ? input : label}
      {end ? label : input}
    </label>
  );
}

/** Yours or Theirs: the model picked, then its numbers stacked under it, the column's width. */
function Side({
  children,
  ...picker
}: ComponentProps<typeof CombatPicker> & { children: ReactNode }) {
  return (
    <div role="group" aria-label={picker.label} className="flex min-w-0 flex-col gap-2">
      <CombatPicker {...picker} />
      {children}
    </div>
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
 * hit, to wound and the save left; the critical hit tables sit underneath, minimised. Yours and
 * Theirs are two columns, each picker over its numbers at the column's width, so nothing is cut
 * off on a phone (William, 24 Nov 2026: "2 columns of yours and theirs with all inputs taking up
 * full width").
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
  const crits = CRITICAL_HIT_TABLES.filter((table) =>
    (kind === "ranged" ? RANGED_CRITICAL_TABLES : MELEE_CRITICAL_TABLES).includes(table.id)
  );
  const tables = kind === "ranged" ? [...crits, MISFIRE_TABLE] : crits;

  return (
    <ModalSheet
      open={kind !== null}
      onOpenChange={onOpenChange}
      kicker="To hit, to wound, crits"
      title={kind === "ranged" ? "Ranged" : "Melee"}
    >
      {/* a thin rule between Yours and Theirs (William, 24 Nov 2026) */}
      <div className="grid grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)] items-stretch gap-3">
        <Side label="Yours" options={yours} value={mineKey} onChange={pickMine}>
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
        </Side>
        <div aria-hidden="true" className="bg-line" />
        <Side label="Theirs" options={theirs} value={theirKey} onChange={pickTheirs} end>
          {kind === "melee" ? (
            <Field
              end
              label="WS"
              value={their.skill}
              onChange={(skill) => setTheir({ ...their, skill })}
            />
          ) : null}
          <Field
            end
            label="T"
            value={their.toughness}
            onChange={(toughness) => setTheir({ ...their, toughness })}
          />
          <Field
            end
            label="Sv"
            value={their.save}
            onChange={(value) => setTheir({ ...their, save: value })}
          />
        </Side>
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
      <CriticalTables tables={tables} />
    </ModalSheet>
  );
}
