import { useCallback, useEffect, useState } from "react";

import { useAppStore } from "@/stores/app-store";
import { toRaceUnitStats, toUnitStats } from "../../components/shared/utils/unit-stats-mapper";

import type { UnitKindKey } from "../../types/units";
import type { UnitKindConfig } from "../../units/unit-kind-types";
import type { UnitLevelUpOptions, UnitLevelUpState } from "./level-up-types";

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

  return {
    ...advance,
    diceColor,
    rollSignal2d6,
    triggerRoll2d6,
    selectedStat,
    statDelta:
      selectedStat && selectableStatSet.has(selectedStat) ? { [selectedStat]: 1 } : undefined,
    unitStats: toUnitStats(unit),
    raceStats: toRaceUnitStats(unit),
    selectableStatSet,
    levelUpError,
    isSubmitting,
    isConfirmDisabled: isSubmitting || isConfirmBlocked,
  };
}
