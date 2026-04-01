import { useEffect, useMemo, useState } from "react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NumberInput } from "@/components/ui/number-input";
import UnitStatsTable from "@/features/warbands/components/shared/unit_details/UnitStatsTable";
import type { UnitStats } from "@/features/battles/components/prebattle/prebattle-types";
import {
  HELPER_DIALOG_CONTENT_CLASS,
  HELPER_NATIVE_SELECT_CLASS,
  HELPER_NATIVE_SELECT_STYLE,
} from "./helper-dialog-styles";

export type ActiveMeleeUnitOption = {
  value: string;
  label: string;
  stats: UnitStats;
  defaultWeaponSkill: number;
  sectionLabel: string;
};

type ActiveMeleeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  yourUnitOptions: ActiveMeleeUnitOption[];
  enemyUnitOptions: ActiveMeleeUnitOption[];
};

const clampWeaponSkill = (value: number) => Math.max(1, Math.min(10, Math.trunc(value || 1)));
const clampBattleStat = (value: number) => Math.max(1, Math.min(10, Math.trunc(value || 1)));

const toHitRequiredRoll = (attackerWs: number, defenderWs: number) => {
  const attacker = clampWeaponSkill(attackerWs);
  const defender = clampWeaponSkill(defenderWs);
  if (attacker > defender) {
    return 3;
  }
  if (attacker === defender) {
    return 4;
  }
  if (defender > attacker * 2) {
    return 5;
  }
  return 4;
};

const toWoundRequiredRoll = (attackerStrength: number, defenderToughness: number) => {
  const strength = clampBattleStat(attackerStrength);
  const toughness = clampBattleStat(defenderToughness);
  const diff = strength - toughness;
  if (diff >= 2) {
    return 2;
  }
  if (diff === 1) {
    return 3;
  }
  if (diff === 0) {
    return 4;
  }
  if (diff === -1) {
    return 5;
  }
  if (diff === -2 || diff === -3) {
    return 6;
  }
  return null;
};

const getArmourSavePenaltyFromStrength = (attackerStrength: number) => {
  const strength = clampBattleStat(attackerStrength);
  return Math.max(0, strength - 3);
};

const parseArmourSave = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string") {
    if (value.trim() === "-") {
      return null;
    }
    const match = value.match(/-?\d+/);
    if (!match) {
      return null;
    }
    const parsed = Number(match[0]);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return Math.trunc(parsed);
  }
  return null;
};

const resolveSavedRoll = (baseArmourSave: number | null, penalty: number) => {
  if (baseArmourSave === null) {
    return null;
  }
  const adjusted = baseArmourSave + penalty;
  if (adjusted >= 7) {
    return null;
  }
  return adjusted;
};

const STATS_TABLE_CLASS =
  "[&_th]:border [&_th]:border-[hsl(var(--primary)/0.2)] [&_th]:px-1 [&_th]:py-1 [&_th]:text-[0.62rem] [&_th]:uppercase [&_th]:tracking-[0.2em] [&_th]:text-muted-foreground [&_td]:border [&_td]:border-[hsl(var(--primary)/0.2)] [&_td]:px-1 [&_td]:py-1 [&_td]:text-[0.82rem] [&_td]:font-semibold [&_td]:text-foreground";

const SECTION_ORDER = ["Heroes", "Henchmen", "Hired Swords", "Temporary Units"] as const;

const groupOptionsBySection = (options: ActiveMeleeUnitOption[]) =>
  SECTION_ORDER.map((sectionLabel) => ({
    sectionLabel,
    options: options.filter((option) => option.sectionLabel === sectionLabel),
  })).filter((group) => group.options.length > 0);

export default function ActiveMeleeDialog({
  open,
  onOpenChange,
  yourUnitOptions,
  enemyUnitOptions,
}: ActiveMeleeDialogProps) {
  const [yourUnitValue, setYourUnitValue] = useState("");
  const [enemyUnitValue, setEnemyUnitValue] = useState("");
  const [yourWeaponSkill, setYourWeaponSkill] = useState("1");
  const [enemyWeaponSkill, setEnemyWeaponSkill] = useState("1");
  const [yourStrength, setYourStrength] = useState("1");
  const [enemyStrength, setEnemyStrength] = useState("1");
  const [yourToughness, setYourToughness] = useState("1");
  const [enemyToughness, setEnemyToughness] = useState("1");

  const yourSelected = useMemo(
    () => yourUnitOptions.find((option) => option.value === yourUnitValue) ?? null,
    [yourUnitOptions, yourUnitValue]
  );
  const enemySelected = useMemo(
    () => enemyUnitOptions.find((option) => option.value === enemyUnitValue) ?? null,
    [enemyUnitOptions, enemyUnitValue]
  );
  const selectedPair = yourSelected && enemySelected ? { your: yourSelected, enemy: enemySelected } : null;
  const yourUnitGroups = useMemo(() => groupOptionsBySection(yourUnitOptions), [yourUnitOptions]);
  const enemyUnitGroups = useMemo(() => groupOptionsBySection(enemyUnitOptions), [enemyUnitOptions]);

  useEffect(() => {
    if (!open) {
      setYourUnitValue("");
      setEnemyUnitValue("");
      setYourWeaponSkill("1");
      setEnemyWeaponSkill("1");
      setYourStrength("1");
      setEnemyStrength("1");
      setYourToughness("1");
      setEnemyToughness("1");
    }
  }, [open]);

  useEffect(() => {
    if (!yourSelected) {
      return;
    }
    setYourWeaponSkill(String(clampWeaponSkill(yourSelected.defaultWeaponSkill)));
    setYourStrength(String(clampBattleStat(Number(yourSelected.stats.strength ?? 1))));
    setYourToughness(String(clampBattleStat(Number(yourSelected.stats.toughness ?? 1))));
  }, [yourSelected?.value]);

  useEffect(() => {
    if (!enemySelected) {
      return;
    }
    setEnemyWeaponSkill(String(clampWeaponSkill(enemySelected.defaultWeaponSkill)));
    setEnemyStrength(String(clampBattleStat(Number(enemySelected.stats.strength ?? 1))));
    setEnemyToughness(String(clampBattleStat(Number(enemySelected.stats.toughness ?? 1))));
  }, [enemySelected?.value]);

  const yourRoll = toHitRequiredRoll(Number(yourWeaponSkill), Number(enemyWeaponSkill));
  const enemyRoll = toHitRequiredRoll(Number(enemyWeaponSkill), Number(yourWeaponSkill));
  const yourToWoundRoll = selectedPair
    ? toWoundRequiredRoll(Number(yourStrength), Number(enemyToughness))
    : null;
  const enemyToWoundRoll = selectedPair
    ? toWoundRequiredRoll(Number(enemyStrength), Number(yourToughness))
    : null;
  const enemyBaseSave = selectedPair ? parseArmourSave(selectedPair.enemy.stats.armour_save) : null;
  const yourBaseSave = selectedPair ? parseArmourSave(selectedPair.your.stats.armour_save) : null;
  const enemySaveRoll = resolveSavedRoll(
    enemyBaseSave,
    getArmourSavePenaltyFromStrength(Number(yourStrength))
  );
  const yourSaveRoll = resolveSavedRoll(
    yourBaseSave,
    getArmourSavePenaltyFromStrength(Number(enemyStrength))
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`max-w-2xl ${HELPER_DIALOG_CONTENT_CLASS}`}>
        <DialogHeader>
          <DialogTitle>Melee</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid gap-2 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">Your unit</span>
              <select
                value={yourUnitValue}
                onChange={(event) => setYourUnitValue(event.target.value)}
                className={HELPER_NATIVE_SELECT_CLASS}
                style={HELPER_NATIVE_SELECT_STYLE}
              >
                <option value="">Select your unit</option>
                {yourUnitGroups.map((group) => (
                  <optgroup key={group.sectionLabel} label={group.sectionLabel}>
                    {group.options.map((option) => (
                      <option key={option.value} value={option.value} className="bg-[#090705] text-foreground">
                        {option.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">Enemy unit</span>
              <select
                value={enemyUnitValue}
                onChange={(event) => setEnemyUnitValue(event.target.value)}
                className={HELPER_NATIVE_SELECT_CLASS}
                style={HELPER_NATIVE_SELECT_STYLE}
              >
                <option value="">Select enemy unit</option>
                {enemyUnitGroups.map((group) => (
                  <optgroup key={group.sectionLabel} label={group.sectionLabel}>
                    {group.options.map((option) => (
                      <option key={option.value} value={option.value} className="bg-[#090705] text-foreground">
                        {option.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
          </div>

          {selectedPair ? (
            <>
              <div className="space-y-2">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{selectedPair.your.label}</p>
                  <div className="battle-stats-shell w-full !rounded-none">
                    <UnitStatsTable
                      stats={selectedPair.your.stats}
                      variant="summary"
                      showTooltips={false}
                      wrapperClassName="w-full px-1 py-1 !rounded-none"
                      className={STATS_TABLE_CLASS}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{selectedPair.enemy.label}</p>
                  <div className="battle-stats-shell w-full !rounded-none">
                    <UnitStatsTable
                      stats={selectedPair.enemy.stats}
                      variant="summary"
                      showTooltips={false}
                      wrapperClassName="w-full px-1 py-1 !rounded-none"
                      className={STATS_TABLE_CLASS}
                    />
                  </div>
                </div>
              </div>

              <div className="battle-inline-panel space-y-2 rounded-md p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  To Hit
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="min-w-0 space-y-2">
                    <label className="space-y-1">
                      <span className="text-xs text-muted-foreground">Your WS</span>
                      <NumberInput
                        min={1}
                        max={10}
                        step={1}
                        inputSize="sm"
                        value={yourWeaponSkill}
                        onChange={(event) => setYourWeaponSkill(event.target.value)}
                        containerClassName="w-full max-w-none"
                        className="text-sm"
                      />
                    </label>
                    <div className="battle-metric-box rounded-md px-2 py-1.5 text-center">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">You</p>
                      <p className="text-base font-semibold text-foreground">{yourRoll}+</p>
                    </div>
                  </div>
                  <div className="min-w-0 space-y-2">
                    <label className="space-y-1">
                      <span className="text-xs text-muted-foreground">Enemy WS</span>
                      <NumberInput
                        min={1}
                        max={10}
                        step={1}
                        inputSize="sm"
                        value={enemyWeaponSkill}
                        onChange={(event) => setEnemyWeaponSkill(event.target.value)}
                        containerClassName="w-full max-w-none"
                        className="text-sm"
                      />
                    </label>
                    <div className="battle-metric-box rounded-md px-2 py-1.5 text-center">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Them</p>
                      <p className="text-base font-semibold text-foreground">{enemyRoll}+</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="battle-inline-panel space-y-2 rounded-md p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  To Wound
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1">
                    <span className="text-xs text-muted-foreground">Your Strength</span>
                    <NumberInput
                      min={1}
                      max={10}
                      step={1}
                      inputSize="sm"
                      value={yourStrength}
                      onChange={(event) => setYourStrength(event.target.value)}
                      containerClassName="w-full max-w-none"
                      className="text-sm"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-muted-foreground">Enemy Strength</span>
                    <NumberInput
                      min={1}
                      max={10}
                      step={1}
                      inputSize="sm"
                      value={enemyStrength}
                      onChange={(event) => setEnemyStrength(event.target.value)}
                      containerClassName="w-full max-w-none"
                      className="text-sm"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1">
                    <span className="text-xs text-muted-foreground">Your Toughness</span>
                    <NumberInput
                      min={1}
                      max={10}
                      step={1}
                      inputSize="sm"
                      value={yourToughness}
                      onChange={(event) => setYourToughness(event.target.value)}
                      containerClassName="w-full max-w-none"
                      className="text-sm"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-muted-foreground">Enemy Toughness</span>
                    <NumberInput
                      min={1}
                      max={10}
                      step={1}
                      inputSize="sm"
                      value={enemyToughness}
                      onChange={(event) => setEnemyToughness(event.target.value)}
                      containerClassName="w-full max-w-none"
                      className="text-sm"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="battle-metric-box rounded-md px-2 py-1.5 text-center">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">You Wound</p>
                    <p className="text-base font-semibold text-foreground">
                      {yourToWoundRoll === null ? "-" : `${yourToWoundRoll}+`}
                    </p>
                  </div>
                  <div className="battle-metric-box rounded-md px-2 py-1.5 text-center">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Them Wound</p>
                    <p className="text-base font-semibold text-foreground">
                      {enemyToWoundRoll === null ? "-" : `${enemyToWoundRoll}+`}
                    </p>
                  </div>
                  <div className="battle-metric-box rounded-md px-2 py-1.5 text-center">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Their Save</p>
                    <p className="text-base font-semibold text-foreground">
                      {enemySaveRoll === null ? "-" : `${enemySaveRoll}+`}
                    </p>
                  </div>
                  <div className="battle-metric-box rounded-md px-2 py-1.5 text-center">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Your Save</p>
                    <p className="text-base font-semibold text-foreground">
                      {yourSaveRoll === null ? "-" : `${yourSaveRoll}+`}
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
