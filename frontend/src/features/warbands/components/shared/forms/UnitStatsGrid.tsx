import { Input } from "@components/input";
import { Label } from "@components/label";
import type { ClipboardEvent, FocusEvent, MouseEvent } from "react";

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
};

export default function UnitStatsGrid<T extends UnitStatsForm>({
  unit,
  index,
  statFields,
  inputClassName,
  onUpdate,
}: UnitStatsGridProps<T>) {
  const orderedFields = [...statFields, "AS"] as const;

  const handleSelectAll = (
    event: FocusEvent<HTMLInputElement> | MouseEvent<HTMLInputElement>
  ) => {
    event.currentTarget.select();
  };

  const handlePaste = (
    event: ClipboardEvent<HTMLInputElement>,
    startFieldIndex: number
  ) => {
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
      <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">Stats</p>
      <div className="grid grid-cols-2 gap-1 sm:grid-cols-5 lg:grid-cols-10">
        {statFields.map((stat, statIndex) => (
          <div key={stat} className="space-y-1 text-center">
            <Label className="text-[9px] uppercase text-muted-foreground">{stat}</Label>
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
              className={`${inputClassName} h-7 px-1 text-xs text-center`}
            />
          </div>
        ))}
        <div className="space-y-1 text-center">
          <Label className="text-[9px] uppercase text-muted-foreground">AS</Label>
          <Input
            type="number"
            max={6}
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
            placeholder="-"
            className={`${inputClassName} h-7 px-1 text-xs text-center`}
          />
        </div>
      </div>
    </div>
  );
}
