import { useCallback, useEffect, useState } from "react";

import { useAppStore } from "@/stores/app-store";
import { toRaceUnitStats, toUnitStats } from "../../components/shared/utils/unit-stats-mapper";
import {
  UNIT_STAT_FIELDS_RACE,
  type UnitStats,
} from "../../components/shared/unit_details/UnitStatsTable";
import { statsAtRaceMax, statsOverRaceMax } from "../../utils/race-max";

import type { Unit, UnitKindKey } from "../../types/units";
import type { UnitKindConfig } from "../../units/unit-kind-types";
import type { UnitLevelUpOptions, UnitLevelUpState } from "./level-up-types";

const RACE_FIELDS = UNIT_STAT_FIELDS_RACE.filter((field) => field.raceKey);
const STAT_LABELS = RACE_FIELDS.map((field) => field.label);
/** Stat values keyed by their column label ("WS"), as the advance table shows them. */
const byLabel = (stats: UnitStats | null) =>
  stats
    ? Object.fromEntries(RACE_FIELDS.map((field) => [field.label, stats[field.statKey]]))
    : null;

/** Decision 10 (BUG-32): taking a stat past the race maximum is allowed, with a warning. */
function raceMaxWarningFor<K extends UnitKindKey>(
  unit: Unit<K>,
  statDelta: Record<string, number> | undefined,
  unitStats: UnitStats,
  raceStats: UnitStats | null
) {
  const field = UNIT_STAT_FIELDS_RACE.find((entry) => statDelta?.[entry.label]);
  if (!field?.raceKey) return "";
  const [over] = statsOverRaceMax(
    [field.label],
    { [field.label]: Number(unitStats[field.statKey]) + 1 },
    raceStats ? { [field.label]: raceStats[field.raceKey] } : null
  );
  if (!over) return "";
  const raceName = unit.race?.name || unit.race_name || "race";
  return `${over.label} ${over.value} is above the ${raceName} maximum of ${over.max}. You can still take this advance.`;
}

/** The level-up dialog's state (design 0.28 §5.3); the kind's advance hook adds its rules. */
export function useUnitLevelUp<K extends UnitKindKey>(
  kind: UnitKindConfig<K>,
  options: UnitLevelUpOptions<K>
): UnitLevelUpState {
  const { unit, open } = options;
  const [rollSignal2d6, setRollSignal2d6] = useState(0);
  const [hasRolled2d6, setHasRolled2d6] = useState(false);
  const [roll2d6Total, setRoll2d6Total] = useState<number | null>(null);
  const [selectedStat, setSelectedStat] = useState<string | null>(null);
  const [levelUpError, setLevelUpError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { diceColor } = useAppStore();
  const selectableStatSet = kind.levelUp.selectableStats;

  useEffect(() => {
    setRollSignal2d6(0);
    setSelectedStat(null);
    setHasRolled2d6(false);
    setRoll2d6Total(null);
    setLevelUpError("");
    setIsSubmitting(false);
  }, [open]);

  const triggerRoll2d6 = useCallback(() => {
    setRollSignal2d6((prev) => prev + 1);
    setHasRolled2d6(true);
    setRoll2d6Total(null);
    setLevelUpError("");
  }, []);

  const { isConfirmBlocked, ...advance } = kind.levelUp.useAdvance({
    ...options,
    kind,
    hasRolled2d6,
    roll2d6Total,
    setRoll2d6Total,
    selectedStat,
    setSelectedStat,
    setLevelUpError,
    setIsSubmitting,
  });

  const unitStats = toUnitStats(unit);
  const raceStats = toRaceUnitStats(unit);
  const statDelta =
    selectedStat && selectableStatSet.has(selectedStat) ? { [selectedStat]: 1 } : undefined;

  return {
    ...advance,
    diceColor,
    rollSignal2d6,
    triggerRoll2d6,
    selectedStat,
    statDelta,
    unitStats,
    raceStats,
    raceMaxWarning: raceMaxWarningFor(unit, statDelta, unitStats, raceStats),
    statsAtMax: new Set(statsAtRaceMax(STAT_LABELS, byLabel(unitStats) ?? {}, byLabel(raceStats))),
    selectableStatSet,
    levelUpError,
    isSubmitting,
    isConfirmDisabled: isSubmitting || isConfirmBlocked,
  };
}
