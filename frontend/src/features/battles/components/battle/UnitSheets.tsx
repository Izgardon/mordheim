import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { ModalSheet } from "@/components/ui/modal-sheet";
import { SectionedSelect, sectionsOf } from "@/components/ui/sectioned-select";
import { StatBoxes } from "@/components/ui/stat-boxes";
import {
  BATTLE_STAT_BOXES,
  STAT_FIELDS,
  type UnitOverride,
  type UnitStats,
} from "@/features/battles/components/prebattle/prebattle-types";
import { typedBattleStat } from "@/features/battles/utils/custom-unit-draft";
import { getErrorMessage } from "@/lib/get-error-message";

import { BATTLE_SECTIONS, battleSectionOf, type BattleUnitView } from "./battle-units";

/** One unit (or a henchmen group, edited for every member) the Edit stats sheet can change. */
export type EditableUnit = { key: string; name: string; keys: string[]; view: BattleUnitView };

/**
 * Edit stats (design E's battle menu): temporary changes for this battle on one of your units or
 * groups, applied and reset as today; they stay temporary unless kept in the Aftermath.
 */
export function EditStatsSheet({
  open,
  onOpenChange,
  units,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  units: EditableUnit[];
  onSave: (keys: string[], override: UnitOverride | undefined) => Promise<void>;
}) {
  const [key, setKey] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const unit = units.find((entry) => entry.key === key) ?? units[0];
  useEffect(() => {
    if (!open || !unit) return;
    const stats = { ...unit.view.unit.stats, ...(unit.view.info?.stats_override ?? {}) };
    setValues(
      Object.fromEntries(
        STAT_FIELDS.map((field) => [
          field.key,
          stats[field.key] === null ? "" : String(stats[field.key] ?? ""),
        ])
      )
    );
    setError("");
    // The form starts from the unit each time it is picked or the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, unit?.key]);

  const run = async (override: UnitOverride | undefined) => {
    if (!unit) return;
    setSaving(true);
    setError("");
    try {
      await onSave(unit.keys, override);
      onOpenChange(false);
    } catch (failure) {
      setError(getErrorMessage(failure, "Couldn't change the stats."));
    } finally {
      setSaving(false);
    }
  };
  const apply = () => {
    const stats: Partial<UnitStats> = {};
    for (const field of STAT_FIELDS) {
      const raw = values[field.key] ?? "";
      if (field.key === "armour_save") {
        stats.armour_save = raw.trim() === "" ? null : Number.parseInt(raw, 10) || null;
      } else {
        stats[field.key] = Number.parseInt(raw, 10) || 0;
      }
    }
    void run({ stats });
  };

  return (
    <ModalSheet
      open={open}
      onOpenChange={onOpenChange}
      kicker="Temporary changes for this battle"
      title="Edit stats"
      footer={
        <div className="grid grid-cols-[1fr_2fr] gap-2">
          <Button
            variant="secondary"
            className="min-h-12"
            disabled={saving}
            onClick={() => void run(undefined)}
          >
            Reset
          </Button>
          <Button className="min-h-12 text-[15px]" disabled={saving || !unit} onClick={apply}>
            Apply
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-1 text-xs font-bold text-text2">
        Unit
        <SectionedSelect
          aria-label="Unit"
          className="h-11 pl-2 md:h-11"
          value={unit?.key ?? ""}
          onValueChange={setKey}
          sections={sectionsOf(
            units,
            BATTLE_SECTIONS,
            (entry) => battleSectionOf(entry.view.unit),
            (entry) => ({ value: entry.key, label: entry.name })
          )}
        />
      </div>
      <StatBoxes
        numeric
        fields={BATTLE_STAT_BOXES}
        values={values}
        className="min-[520px]:grid-cols-5"
        onChange={(patch) =>
          setValues((current) => {
            const typed = BATTLE_STAT_BOXES.flatMap(({ key }) => {
              const value = patch[key];
              return value === undefined ? [] : [[key, typedBattleStat(key, value)]];
            });
            return { ...current, ...Object.fromEntries(typed) };
          })
        }
      />
      <p className="m-0 text-xs text-muted-foreground">
        A henchmen group changes for every member. Keep a change for good in the Aftermath.
      </p>
      {error ? <p className="m-0 text-sm text-danger">{error}</p> : null}
    </ModalSheet>
  );
}
