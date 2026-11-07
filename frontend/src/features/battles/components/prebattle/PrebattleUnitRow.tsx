import type { ReactNode } from "react";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ChipLabel } from "@/components/ui/chip";
import { StatBoxes } from "@/components/ui/stat-boxes";
import { StatStrip } from "@/components/ui/stat-strip";
import {
  BATTLE_STAT_BOXES,
  type PrebattleUnit,
  type UnitOverride,
} from "@/features/battles/components/prebattle/prebattle-types";
import type { PrebattleConfig } from "@/features/battles/hooks/usePrebattleConfig";
import { typedBattleStat } from "@/features/battles/utils/custom-unit-draft";
import { cn } from "@/lib/utils";

import { STAT_SHORT, statValues, distinctType, writtenShown } from "../battle/battle-units";

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
  const values = Object.fromEntries(
    BATTLE_STAT_BOXES.map(({ key }) => {
      const value = override[key] ?? unit.stats[key];
      return [key, value === null || value === undefined ? "" : String(value)];
    })
  );
  return (
    <div className="flex flex-col gap-2 border-t border-line pt-2">
      <StatBoxes
        numeric
        fields={BATTLE_STAT_BOXES}
        values={values}
        name={(label) => `${unit.displayName} ${label}`}
        onChange={(patch) => {
          for (const { key } of BATTLE_STAT_BOXES) {
            const typed = patch[key];
            if (typed !== undefined)
              config.updateOverrideStat(unit, key, typedBattleStat(key, typed));
          }
        }}
      />
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

/**
 * One unit a warband may bring: its tick (your own, while you may change it), name and type, a
 * "Missing" chip for a unit missing games, its battle stat changes and Edit stats, Remove for a
 * temporary unit, and under it the rolls it makes before the battle (`rolls`), ticked or not.
 */
export default function PrebattleUnitRow({
  unit,
  picked,
  override,
  config,
  detail,
  onRemove,
  rolls,
}: {
  unit: PrebattleUnit;
  picked: boolean;
  override?: UnitOverride;
  config?: PrebattleConfig;
  detail?: string;
  onRemove?: () => void;
  rolls?: ReactNode;
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
            {[distinctType(unit), detail].filter(Boolean).join(" · ")}
          </span>
          {unit.outReason ? <span className="text-xs text-danger">{unit.outReason}</span> : null}
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
      {rolls ? <div className={config ? "pl-14" : undefined}>{rolls}</div> : null}
      {editing && config ? (
        <StatEditor unit={unit} config={config} />
      ) : picked && changed.length ? (
        <StatStrip
          values={statValues(stats, writtenShown(unit, changed))}
          highlighted={changed.map((key) => STAT_SHORT[key])}
        />
      ) : null}
    </li>
  );
}
