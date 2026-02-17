import { useCallback, useEffect, useState } from "react";

import { useAppStore } from "@/stores/app-store";
import { getWarbandHeroDetail, levelUpWarbandHero } from "../../api/warbands-api";
import { toRaceUnitStats, toUnitStats } from "../../components/shared/utils/unit-stats-mapper";
import {
  buildLevelUpPayload,
  HERO_SELECTABLE_STAT_SET,
  isHeroSelectableStat,
  needsHero1d6Followup,
  OTHER_OPTIONS,
  parseRollTotal,
  resolveHero1d6Stat,
  resolveHero2d6Stat,
} from "../../utils/levelup-utils";

import type { WarbandHero } from "../../types/warband-types";

type UseHeroLevelUpOptions = {
  hero: WarbandHero;
  warbandId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLevelUpLogged?: (updatedHero: WarbandHero) => void;
};

export default function useHeroLevelUp({
  hero,
  warbandId,
  open,
  onOpenChange,
  onLevelUpLogged,
}: UseHeroLevelUpOptions) {
  const [rollSignal2d6, setRollSignal2d6] = useState(0);
  const [rollSignal1d6, setRollSignal1d6] = useState(0);
  const [selectedStat, setSelectedStat] = useState<string | null>(null);
  const [hasRolled2d6, setHasRolled2d6] = useState(false);
  const [roll2d6Total, setRoll2d6Total] = useState<number | null>(null);
  const [roll1d6Total, setRoll1d6Total] = useState<number | null>(null);
  const [levelUpError, setLevelUpError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [heroDetail, setHeroDetail] = useState<WarbandHero | null>(null);
  const [heroDetailLoading, setHeroDetailLoading] = useState(false);
  const { diceColor } = useAppStore();

  const heroWithRace = heroDetail ?? hero;
  const canCast = Boolean(heroWithRace.caster && heroWithRace.caster !== "No");
  const heroStats = toUnitStats(heroWithRace);
  const raceStats = toRaceUnitStats(heroWithRace);
  const statDelta = isHeroSelectableStat(selectedStat)
    ? ({ [selectedStat]: 1 } as Partial<Record<string, number>>)
    : undefined;

  const canRollSecondDie =
    hasRolled2d6 && roll2d6Total !== null && needsHero1d6Followup(roll2d6Total);

  const availableOtherOptions = canCast
    ? OTHER_OPTIONS
    : OTHER_OPTIONS.filter((option) => option.id !== "Spell");

  // Reset detail when hero changes
  useEffect(() => {
    setHeroDetail(null);
  }, [hero.id]);

  // Fetch race detail if missing
  useEffect(() => {
    if (!open) return;
    if (hero.race || heroDetail?.race || heroDetailLoading) return;
    setHeroDetailLoading(true);
    getWarbandHeroDetail(warbandId, hero.id)
      .then((data) => setHeroDetail(data))
      .catch(() => setHeroDetail(null))
      .finally(() => setHeroDetailLoading(false));
  }, [hero.id, hero.race, heroDetail?.race, heroDetailLoading, open, warbandId]);

  // Reset state on open/close
  useEffect(() => {
    setRollSignal2d6(0);
    setRollSignal1d6(0);
    setSelectedStat(null);
    setHasRolled2d6(false);
    setRoll2d6Total(null);
    setRoll1d6Total(null);
    setLevelUpError("");
    setIsSubmitting(false);
  }, [open]);

  // Clear spell selection if not a caster
  useEffect(() => {
    if (!canCast && selectedStat === "Spell") {
      setSelectedStat(null);
    }
  }, [canCast, selectedStat]);

  const handleSelectStat = useCallback((statId: string) => {
    if (statId === "Spell" && !canCast) return;
    setSelectedStat((current) => (current === statId ? null : statId));
    setLevelUpError("");
  }, [canCast]);

  const triggerRoll2d6 = useCallback(() => {
    setRollSignal2d6((prev) => prev + 1);
    setHasRolled2d6(true);
    setRoll2d6Total(null);
    setLevelUpError("");
  }, []);

  const triggerRoll1d6 = useCallback(() => {
    setRollSignal1d6((prev) => prev + 1);
  }, []);

  const handleRoll2d6Complete = useCallback((results: unknown) => {
    const total = parseRollTotal(results);
    setRoll2d6Total(total);
    setRoll1d6Total(null);
    if (total !== null) {
      setSelectedStat(resolveHero2d6Stat(total));
    }
  }, []);

  const handleRoll1d6Complete = useCallback((results: unknown) => {
    const total = parseRollTotal(results);
    if (total === null) return;
    setRoll1d6Total(total);
    if (roll2d6Total !== null) {
      const stat = resolveHero1d6Stat(roll2d6Total, total);
      if (stat) setSelectedStat(stat);
    }
  }, [roll2d6Total]);

  const handleLevelUpConfirm = useCallback(async () => {
    if (!selectedStat) {
      setLevelUpError("A Level up must be chosen.");
      return;
    }

    const heroName = hero.name?.trim() || hero.unit_type?.trim() || "Unknown Hero";
    const payload = buildLevelUpPayload({
      unitName: heroName,
      selectedStat,
      roll2d6Total,
      roll1d6Total,
    });

    setIsSubmitting(true);
    setLevelUpError("");
    try {
      const updatedHero = await levelUpWarbandHero(warbandId, hero.id, payload);
      if (updatedHero) {
        onLevelUpLogged?.(updatedHero);
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
  }, [selectedStat, hero, warbandId, roll2d6Total, roll1d6Total, onLevelUpLogged, onOpenChange]);

  return {
    // dice state
    rollSignal2d6,
    rollSignal1d6,
    roll2d6Total,
    roll1d6Total,
    hasRolled2d6,
    canRollSecondDie,
    diceColor,

    // stat selection
    selectedStat,
    statDelta,
    heroStats,
    raceStats,
    canCast,
    availableOtherOptions,
    selectableStatSet: HERO_SELECTABLE_STAT_SET,

    // form state
    levelUpError,
    isSubmitting,

    // actions
    handleSelectStat,
    triggerRoll2d6,
    triggerRoll1d6,
    handleRoll2d6Complete,
    handleRoll1d6Complete,
    handleLevelUpConfirm,
  };
}
