import { Input } from "@components/input";
import { Label } from "@components/label";
import type { ClipboardEvent, FocusEvent, MouseEvent } from "react";

import { armourSaveToForm, parseArmourSave } from "../../../units/unit-form-helpers";
import { describeOverRaceMax, statsOverRaceMax } from "../../../utils/race-max";

type UnitStatsForm = {
  stats: Record<string, string>;
  armour_save: string;
};

type UnitStatsGridProps<T extends UnitStatsForm> = {
  unit: T;
  index: number;
  statFields: readonly string[];
  inputClassName: string;
  onUpdate: (index: number, updater: (unit: T) => T) => void;
  raceStats?: Record<string, number | null>;
};

export default function UnitStatsGrid<T extends UnitStatsForm>({
  unit,
  index,
  statFields,
  inputClassName,
  onUpdate,
  raceStats,
}: UnitStatsGridProps<T>) {
  const orderedFields = [...statFields, "AS"] as const;
  // Above the race maximum is allowed (house rules, hand fixes); it is only pointed out.
  const overRaceMax = statsOverRaceMax(statFields, unit.stats, raceStats);
  const overLabels = new Set(overRaceMax.map((entry) => entry.label));
  const armourSave = parseArmourSave(unit.armour_save);

  const handleSelectAll = (event: FocusEvent<HTMLInputElement> | MouseEvent<HTMLInputElement>) => {
    event.currentTarget.select();
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>, startFieldIndex: number) => {
    const clipboardText = event.clipboardData.getData("text");
    const pastedValues = clipboardText
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split(/\t|\n/)
      .map((value) => value.trim());

    while (pastedValues.length > 0 && pastedValues[pastedValues.length - 1] === "") {
      pastedValues.pop();
    }

    if (pastedValues.length <= 1) {
      return;
    }

    event.preventDefault();

    onUpdate(index, (current) => {
      const nextStats = { ...current.stats };
      let nextArmourSave = current.armour_save;

      pastedValues.forEach((value, offset) => {
        const targetField = orderedFields[startFieldIndex + offset];
        if (!targetField) {
          return;
        }
        if (targetField === "AS") {
          nextArmourSave = value;
          return;
        }
        nextStats[targetField] = value;
      });

      return {
        ...current,
        stats: nextStats,
        armour_save: nextArmourSave,
      };
    });
  };

  return (
    <div className="space-y-2 rounded-xl border border-border/60 bg-background/50 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
        Stats
      </p>
      <div className="grid grid-cols-2 gap-1 sm:grid-cols-5 lg:grid-cols-10">
        {statFields.map((stat, statIndex) => {
          const raceVal = raceStats?.[stat];
          return (
            <div key={stat} className="space-y-1 text-center">
              <Label className="text-[9px] uppercase text-muted-foreground">{stat}</Label>
              <div className="relative">
                <Input
                  value={unit.stats[stat]}
                  onFocus={handleSelectAll}
                  onClick={handleSelectAll}
                  onPaste={(event) => handlePaste(event, statIndex)}
                  onChange={(event) =>
                    onUpdate(index, (current) => ({
                      ...current,
                      stats: { ...current.stats, [stat]: event.target.value },
                    }))
                  }
                  placeholder="-"
                  aria-invalid={overLabels.has(stat) || undefined}
                  className={`${inputClassName} h-7 text-xs text-center ${raceVal != null ? "px-1 pr-4" : "px-1"} ${overLabels.has(stat) ? "!border-amber-400" : ""}`}
                />
                {raceVal != null && (
                  <span className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground">
                    /{raceVal}
                  </span>
                )}
              </div>
            </div>
          );
        })}
        <div className="space-y-1 text-center">
          <Label className="text-[9px] uppercase text-muted-foreground">AS</Label>
          {/* Decision 11: "5", "5+", "0+" or "-1+", shown as "N+" once typed. */}
          <Input
            aria-label="Armour save"
            value={unit.armour_save}
            onFocus={handleSelectAll}
            onClick={handleSelectAll}
            onPaste={(event) => handlePaste(event, statFields.length)}
            onChange={(event) =>
              onUpdate(index, (current) => ({
                ...current,
                armour_save: event.target.value,
              }))
            }
            onBlur={() =>
              onUpdate(index, (current) => {
                const save = parseArmourSave(current.armour_save);
                return typeof save === "number"
                  ? { ...current, armour_save: armourSaveToForm(save) }
                  : current;
              })
            }
            placeholder="-"
            aria-invalid={armourSave === undefined || undefined}
            className={`${inputClassName} h-7 px-1 text-xs text-center ${armourSave === undefined ? "!border-amber-400" : ""}`}
          />
        </div>
      </div>
      {armourSave === undefined ? (
        <p role="status" className="text-xs text-amber-400">
          Enter an armour save from -5+ to 6+, such as 4+, or leave it empty.
        </p>
      ) : typeof armourSave === "number" && armourSave <= 1 ? (
        <p className="text-xs text-muted-foreground">A roll of 1 always fails.</p>
      ) : null}
      {overRaceMax.length > 0 ? (
        <p role="status" className="text-xs text-amber-400">
          Above the race maximum: {describeOverRaceMax(overRaceMax)}. This is allowed; check
          it&apos;s what you meant.
        </p>
      ) : null}
    </div>
  );
}
