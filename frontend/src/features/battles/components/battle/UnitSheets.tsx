import { useEffect, useMemo, useState } from "react";

import { NumberInput } from "@/components/ui/number-input";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { ModalSheet } from "@/components/ui/modal-sheet";
import { SectionedSelect, sectionsOf } from "@/components/ui/sectioned-select";
import {
  STAT_FIELDS,
  type UnitOverride,
  type UnitStats,
} from "@/features/battles/components/prebattle/prebattle-types";
import CustomUnitFields from "@/features/battles/components/shared/CustomUnitFields";
import type { CustomUnitDraftState } from "@/features/battles/hooks/useCustomUnitDraft";
import type { NeutralGroupInput } from "@/features/battles/hooks/useBattleScreen";
import type { BattleNeutralGroup, BattleUnitStats } from "@/features/battles/types/battle-types";
import { STAT_FIELDS as PROFILE_FIELDS } from "@/features/catalogue/utils/statblock";
import { useCatalogue } from "@/lib/catalogue-queries";
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
      <div className="grid grid-cols-5 gap-1.5">
        {STAT_FIELDS.map((field) => (
          <label
            key={field.key}
            className="flex flex-col items-center gap-1 text-[10px] font-bold text-faint"
          >
            {field.key === "armour_save" ? "Sv" : field.label}
            <NumberInput
              inputSize="sm"
              aria-label={field.label}
              value={values[field.key] ?? ""}
              onChange={(event) =>
                setValues({
                  ...values,
                  [field.key]: event.target.value.replace(/[^\d]/g, "").slice(0, 2),
                })
              }
              className="px-1 text-center font-mono"
            />
          </label>
        ))}
      </div>
      <p className="m-0 text-xs text-muted-foreground">
        A henchmen group changes for every member. Keep a change for good in the Aftermath.
      </p>
      {error ? <p className="m-0 text-sm text-danger">{error}</p> : null}
    </ModalSheet>
  );
}

/**
 * Add a unit (design E's battle menu): a temporary unit to your warband, as today, or one more
 * creature in a neutral group.
 */
export function AddUnitSheet({
  open,
  onOpenChange,
  draft,
  groups,
  canAddToWarband,
  initialGroup,
  onAddToWarband,
  onAddCreature,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: CustomUnitDraftState;
  groups: BattleNeutralGroup[];
  canAddToWarband: boolean;
  /** Opened from a neutral group's Add a unit: that group is picked. */
  initialGroup?: string;
  onAddToWarband: () => Promise<boolean>;
  onAddCreature: (groupKey: string) => Promise<unknown>;
}) {
  const [target, setTarget] = useState("warband");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open)
      setTarget(initialGroup ?? (canAddToWarband ? "warband" : (groups[0]?.key ?? "warband")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialGroup]);
  const group = groups.find((entry) => entry.key === target);
  const add = async () => {
    setSaving(true);
    try {
      if (group) {
        await onAddCreature(group.key);
        onOpenChange(false);
      } else {
        if (await onAddToWarband()) onOpenChange(false);
      }
    } finally {
      setSaving(false);
    }
  };
  return (
    <ModalSheet
      open={open}
      onOpenChange={onOpenChange}
      kicker="Mid-battle"
      title="Add a unit"
      footer={
        <div className="grid grid-cols-[1fr_2fr] gap-2">
          <Button variant="secondary" className="min-h-12" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="min-h-12 text-[15px]" disabled={saving} onClick={() => void add()}>
            {group ? `Add a ${group.creature_type}` : "Add to my warband"}
          </Button>
        </div>
      }
    >
      <div role="group" aria-label="Add to" className="flex flex-wrap gap-1.5">
        {canAddToWarband ? (
          <Chip pressed={target === "warband"} onClick={() => setTarget("warband")}>
            My warband
          </Chip>
        ) : null}
        {groups.map((entry) => (
          <Chip key={entry.key} pressed={target === entry.key} onClick={() => setTarget(entry.key)}>
            {entry.name} · neutral
          </Chip>
        ))}
      </div>
      {group ? (
        <p className="m-0 text-sm text-text2">
          One more {group.creature_type} joins {group.name}, numbered after the last.
        </p>
      ) : (
        <CustomUnitFields draft={draft} />
      )}
    </ModalSheet>
  );
}

/**
 * Add a neutral group (design E): creatures nobody plays, a name, a creature type from the
 * bestiary (its profile comes with it) or typed, and how many.
 */
export function AddNeutralGroupSheet({
  open,
  onOpenChange,
  campaignId,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: number;
  onAdd: (group: NeutralGroupInput) => Promise<void>;
}) {
  const bestiary = useCatalogue("bestiary", campaignId, { enabled: open }).data;
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [count, setCount] = useState("3");
  const [beastId, setBeastId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (open) {
      setName("");
      setType("");
      setCount("3");
      setBeastId(null);
      setError("");
    }
  }, [open]);
  const matches = useMemo(() => {
    const query = type.trim().toLowerCase();
    if (!query || beastId !== null) return [];
    return bestiary.filter((entry) => entry.name.toLowerCase().includes(query)).slice(0, 6);
  }, [beastId, bestiary, type]);
  const beast = bestiary.find((entry) => entry.id === beastId);

  const add = async () => {
    const creatureType = type.trim();
    if (!creatureType) {
      setError("Give the creatures a type.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      // a battle's own creatures hold numbers only: a written stat with none ("2D6", "-") is left out
      const stats: Partial<BattleUnitStats> | undefined = beast?.has_profile
        ? {
            ...Object.fromEntries(
              PROFILE_FIELDS.flatMap(({ key }) => (beast[key] === null ? [] : [[key, beast[key]]]))
            ),
            armour_save: beast.armour_save,
          }
        : undefined;
      await onAdd({
        name: name.trim() || `${creatureType}s`,
        creatureType,
        count: Math.max(1, Math.min(30, Number.parseInt(count, 10) || 1)),
        wounds: Math.max(1, Math.min(10, beast?.wounds || 1)),
        stats,
      });
      onOpenChange(false);
    } catch (failure) {
      setError(getErrorMessage(failure, "Couldn't add the group."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalSheet
      open={open}
      onOpenChange={onOpenChange}
      kicker="Monsters or bystanders nobody plays"
      title="Add a neutral group"
      footer={
        <div className="grid grid-cols-[1fr_2fr] gap-2">
          <Button variant="secondary" className="min-h-12" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="min-h-12 text-[15px]" disabled={saving} onClick={() => void add()}>
            {saving ? "Adding…" : "Add the group"}
          </Button>
        </div>
      }
    >
      <label className="flex flex-col gap-1 text-xs font-bold text-text2">
        Creature type
        <Input
          value={type}
          placeholder="Search creatures"
          onChange={(event) => {
            setType(event.target.value);
            setBeastId(null);
          }}
        />
      </label>
      {matches.length ? (
        <div className="flex flex-col">
          {matches.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => {
                setBeastId(entry.id);
                setType(entry.name);
              }}
              className="flex min-h-11 items-center justify-between border-t border-line px-2 text-left text-sm text-ink"
            >
              {entry.name}
              <span className="text-xs text-muted-foreground">
                {entry.has_profile ? `W ${entry.wounds}` : "No profile"}
              </span>
            </button>
          ))}
        </div>
      ) : null}
      {beast ? (
        <p className="m-0 text-xs text-muted-foreground">
          From the bestiary: {beast.name}
          {beast.has_profile
            ? `, M${beast.movement} WS${beast.weapon_skill} T${beast.toughness} W${beast.wounds}`
            : ""}
          .
        </p>
      ) : null}
      <div className="grid grid-cols-[2fr_1fr] gap-2">
        <label className="flex flex-col gap-1 text-xs font-bold text-text2">
          Group name
          <Input
            value={name}
            placeholder={type.trim() ? `${type.trim()}s` : undefined}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold text-text2">
          How many
          <NumberInput
            value={count}
            onChange={(event) => setCount(event.target.value.replace(/[^\d]/g, "").slice(0, 2))}
          />
        </label>
      </div>
      {error ? <p className="m-0 text-sm text-danger">{error}</p> : null}
    </ModalSheet>
  );
}
