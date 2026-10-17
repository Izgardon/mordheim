import { useCallback, useEffect, useState } from "react";

import { unitApi } from "../../units/unit-api";
import {
  buildLevelUpPayload,
  needsHero1d6Followup,
  OTHER_OPTIONS,
  parseRollTotal,
  resolveHero1d6Stat,
  resolveHero2d6Stat,
} from "../../utils/levelup-utils";

import type { LevelUpCore, UnitAdvance } from "./level-up-types";

type FollowUpKind = "hero" | "hired_sword";

/**
 * Hero and hired-sword advances: 2d6 with a 1d6 follow-up on 6/8/9, any stat or a
 * Skill/Spell/Special placeholder (Spell for casters only); one POST names the unit under `hero`.
 */
export function useFollowUpAdvance<K extends FollowUpKind>({
  kind,
  unit,
  warbandId,
  open,
  onOpenChange,
  onLevelUpLogged,
  hasRolled2d6,
  roll2d6Total,
  setRoll2d6Total,
  selectedStat,
  setSelectedStat,
  setLevelUpError,
  setIsSubmitting,
}: LevelUpCore<K>): UnitAdvance {
  const [rollSignal1d6, setRollSignal1d6] = useState(0);
  const [roll1d6Total, setRoll1d6Total] = useState<number | null>(null);
  const canCast = Boolean(unit.caster && unit.caster !== "No");

  useEffect(() => {
    setRollSignal1d6(0);
    setRoll1d6Total(null);
  }, [open]);

  useEffect(() => {
    if (!canCast && selectedStat === "Spell") {
      setSelectedStat(null);
    }
  }, [canCast, selectedStat, setSelectedStat]);

  const handleSelectStat = useCallback(
    (statId: string) => {
      if (statId === "Spell" && !canCast) return;
      setSelectedStat((current) => (current === statId ? null : statId));
      setLevelUpError("");
    },
    [canCast, setLevelUpError, setSelectedStat]
  );

  const handleRoll2d6Complete = useCallback(
    (results: unknown) => {
      const total = parseRollTotal(results);
      setRoll2d6Total(total);
      setRoll1d6Total(null);
      if (total !== null) {
        setSelectedStat(resolveHero2d6Stat(total));
      }
    },
    [setRoll2d6Total, setSelectedStat]
  );

  const handleRoll1d6Complete = useCallback(
    (results: unknown) => {
      const total = parseRollTotal(results);
      if (total === null) return;
      setRoll1d6Total(total);
      if (roll2d6Total !== null) {
        const stat = resolveHero1d6Stat(roll2d6Total, total);
        if (stat) setSelectedStat(stat);
      }
    },
    [roll2d6Total, setSelectedStat]
  );

  const handleLevelUpConfirm = useCallback(async () => {
    if (!selectedStat) {
      setLevelUpError("A Level up must be chosen.");
      return;
    }

    const unitName = unit.name?.trim() || unit.unit_type?.trim() || kind.levelUp.nameFallback;
    const payload = buildLevelUpPayload({ unitName, selectedStat, roll2d6Total, roll1d6Total });

    setIsSubmitting(true);
    setLevelUpError("");
    try {
      const updated = await unitApi(kind.key).levelUp(warbandId, unit.id, payload);
      if (updated) {
        onLevelUpLogged?.(updated);
      }
      onOpenChange(false);
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setLevelUpError(errorResponse.message || "Unable to log level up");
      } else {
        setLevelUpError("Unable to log level up");
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [
    selectedStat,
    unit,
    kind,
    warbandId,
    roll2d6Total,
    roll1d6Total,
    onLevelUpLogged,
    onOpenChange,
    setIsSubmitting,
    setLevelUpError,
  ]);

  return {
    handleSelectStat,
    handleRoll2d6Complete,
    handleLevelUpConfirm,
    isConfirmBlocked: false,
    followUp: {
      rollSignal1d6,
      canRollSecondDie: hasRolled2d6 && roll2d6Total !== null && needsHero1d6Followup(roll2d6Total),
      triggerRoll1d6: () => setRollSignal1d6((prev) => prev + 1),
      handleRoll1d6Complete,
      otherOptions: canCast
        ? OTHER_OPTIONS
        : OTHER_OPTIONS.filter((option) => option.id !== "Spell"),
    },
  };
}
