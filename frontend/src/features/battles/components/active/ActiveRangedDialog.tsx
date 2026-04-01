import { useEffect, useMemo, useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NumberInput } from "@/components/ui/number-input";
import { Tooltip } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import type { UnitStats } from "@/features/battles/components/prebattle/prebattle-types";
import UnitStatsTable from "@/features/warbands/components/shared/unit_details/UnitStatsTable";
import {
  HELPER_DIALOG_CONTENT_CLASS,
  HELPER_NATIVE_SELECT_CLASS,
  HELPER_NATIVE_SELECT_STYLE,
} from "./helper-dialog-styles";

export type ActiveRangedUnitOption = {
  value: string;
  label: string;
  stats: UnitStats;
  defaultBallisticSkill: number;
};

type ActiveRangedDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  yourUnitOptions: ActiveRangedUnitOption[];
};

const clampBallisticSkill = (value: number) => Math.max(1, Math.min(10, Math.trunc(value || 1)));
const toBaseRangedRoll = (ballisticSkill: number) => 7 - clampBallisticSkill(ballisticSkill);
const formatRangedRoll = (requiredRoll: number) => {
  if (requiredRoll <= 6) {
    return `${requiredRoll}+`;
  }
  if (requiredRoll === 7) {
    return "6+ -> 4+";
  }
  if (requiredRoll === 8) {
    return "6+ -> 5+";
  }
  return "6+ -> 6+";
};

const STATS_TABLE_CLASS =
  "[&_th]:border [&_th]:border-[hsl(var(--primary)/0.2)] [&_th]:px-1 [&_th]:py-1 [&_th]:text-[0.62rem] [&_th]:uppercase [&_th]:tracking-[0.2em] [&_th]:text-muted-foreground [&_td]:border [&_td]:border-[hsl(var(--primary)/0.2)] [&_td]:px-1 [&_td]:py-1 [&_td]:text-[0.82rem] [&_td]:font-semibold [&_td]:text-foreground";

const MODIFIERS = [
  { key: "cover", label: "Cover", modifier: -1 },
  { key: "longRange", label: "Long range", modifier: -1 },
  { key: "movingAndShooting", label: "Moving & shooting", modifier: -1 },
  { key: "largeTarget", label: "Large target", modifier: 1 },
] as const;

type ModifierKey = (typeof MODIFIERS)[number]["key"];
type ModifierState = Record<ModifierKey, boolean>;

const DEFAULT_MODIFIERS: ModifierState = {
  cover: false,
  longRange: false,
  movingAndShooting: false,
  largeTarget: false,
};

export default function ActiveRangedDialog({
  open,
  onOpenChange,
  yourUnitOptions,
}: ActiveRangedDialogProps) {
  const [yourUnitValue, setYourUnitValue] = useState("");
  const [ballisticSkill, setBallisticSkill] = useState("1");
  const [modifiers, setModifiers] = useState<ModifierState>(DEFAULT_MODIFIERS);

  const selectedUnit = useMemo(
    () => yourUnitOptions.find((option) => option.value === yourUnitValue) ?? null,
    [yourUnitOptions, yourUnitValue]
  );

  useEffect(() => {
    if (!open) {
      setYourUnitValue("");
      setBallisticSkill("1");
      setModifiers(DEFAULT_MODIFIERS);
    }
  }, [open]);

  useEffect(() => {
    if (!selectedUnit) {
      return;
    }
    setBallisticSkill(String(clampBallisticSkill(selectedUnit.defaultBallisticSkill)));
  }, [selectedUnit?.value]);

  const baseRoll = toBaseRangedRoll(Number(ballisticSkill));
  const totalModifier = MODIFIERS.reduce(
    (sum, modifier) => sum + (modifiers[modifier.key] ? modifier.modifier : 0),
    0
  );
  const finalRoll = baseRoll - totalModifier;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`max-w-2xl ${HELPER_DIALOG_CONTENT_CLASS}`}>
        <DialogHeader>
          <DialogTitle>Ranged</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Your unit</span>
            <select
              value={yourUnitValue}
              onChange={(event) => setYourUnitValue(event.target.value)}
              className={HELPER_NATIVE_SELECT_CLASS}
              style={HELPER_NATIVE_SELECT_STYLE}
            >
              <option value="">Select your unit</option>
              {yourUnitOptions.map((option) => (
                <option key={option.value} value={option.value} className="bg-[#090705] text-foreground">
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {selectedUnit ? (
            <>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{selectedUnit.label}</p>
                <div className="battle-stats-shell w-full !rounded-none">
                  <UnitStatsTable
                    stats={selectedUnit.stats}
                    variant="summary"
                    showTooltips={false}
                    wrapperClassName="w-full px-1 py-1 !rounded-none"
                    className={STATS_TABLE_CLASS}
                  />
                </div>
              </div>

              <div className="battle-inline-panel space-y-2 rounded-md p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  To Hit
                </p>
                <label className="space-y-1">
                  <span className="text-xs text-muted-foreground">Your BS</span>
                  <NumberInput
                    min={1}
                    max={10}
                    step={1}
                    inputSize="sm"
                    value={ballisticSkill}
                    onChange={(event) => setBallisticSkill(event.target.value)}
                    containerClassName="w-full max-w-[50%] md:max-w-[12rem]"
                    className="text-sm"
                  />
                </label>

                <div className="grid grid-cols-2 gap-2">
                  {MODIFIERS.map((modifier) => (
                    <label key={modifier.key} className="inline-flex items-center gap-2">
                      <Checkbox
                        checked={modifiers[modifier.key]}
                        onChange={(event) =>
                          setModifiers((prev) => ({
                            ...prev,
                            [modifier.key]: event.currentTarget.checked,
                          }))
                        }
                      />
                      <span className="text-sm text-foreground">
                        {modifier.label} ({modifier.modifier > 0 ? "+" : ""}
                        {modifier.modifier})
                      </span>
                      {modifier.key === "cover" && modifiers.cover && (
                        <span onClick={(e) => e.preventDefault()}>
                          <Tooltip
                            trigger={
                              <Info className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                            }
                            content="A miss by 1 hits the cover instead — if the cover is another model, they take the hit."
                            maxWidth={220}
                          />
                        </span>
                      )}
                    </label>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2 md:max-w-[15rem]">
                  <div className="battle-metric-box rounded-md px-2 py-1.5 text-center">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Base</p>
                    <p className="text-base font-semibold text-foreground">
                      {formatRangedRoll(baseRoll)}
                    </p>
                  </div>
                  <div className="battle-metric-box rounded-md px-2 py-1.5 text-center">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Final</p>
                    <p className="text-base font-semibold text-foreground">
                      {formatRangedRoll(finalRoll)}
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
