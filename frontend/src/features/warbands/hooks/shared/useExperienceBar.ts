import { useEffect, useRef, useState } from "react";

import { useAppStore } from "@/stores/app-store";

import type { LevelInfo } from "../../components/heroes/utils/hero-level";

type UseExperienceBarOptions = {
  xp: number | null;
  halfRate?: boolean;
  getLevelInfo: (xp: number) => LevelInfo;
  onSave: (newXp: number) => Promise<number>;
};

type DrainInfo = {
  oldFilled: number;
  oldTotal: number;
};

const DRAIN_STEP_MS = 200;

const normalizeHalfStep = (value: number) => Math.round(value * 2) / 2;

const toNumber = (value: number | string | null | undefined) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function useExperienceBar({ xp: initialXp, halfRate, getLevelInfo, onSave }: UseExperienceBarOptions) {
  const { campaignStarted } = useAppStore();
  const [xp, setXp] = useState(() => toNumber(initialXp));
  const [isUpdating, setIsUpdating] = useState(false);
  const [isGlowing, setIsGlowing] = useState(false);
  const [draining, setDraining] = useState<DrainInfo | null>(null);
  const glowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drainTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { nextLevelAt, gap, currentLevelAt } = getLevelInfo(xp);

  const isMaxLevel = nextLevelAt === null;
  const filled = isMaxLevel ? 1 : xp - currentLevelAt;
  const totalSegments = isMaxLevel ? 1 : (gap ?? 1);

  const prevLevelAtRef = useRef(currentLevelAt);
  const pendingFillRef = useRef<{ filled: number; totalSegments: number } | null>(null);

  useEffect(() => {
    const levelChanged = currentLevelAt !== prevLevelAtRef.current;
    prevLevelAtRef.current = currentLevelAt;

    if (levelChanged) {
      pendingFillRef.current = { filled, totalSegments };
      setDraining((prev) => ({
        oldFilled: prev?.oldFilled ?? filled,
        oldTotal: prev?.oldTotal ?? totalSegments,
      }));
    }
  }, [filled, totalSegments, currentLevelAt]);

  useEffect(() => {
    if (!draining) return;

    const totalDrainTime = draining.oldFilled * DRAIN_STEP_MS + 500;
    drainTimerRef.current = setTimeout(() => {
      setDraining(null);
    }, totalDrainTime);

    return () => {
      if (drainTimerRef.current) clearTimeout(drainTimerRef.current);
    };
  }, [draining]);

  useEffect(() => {
    return () => {
      if (drainTimerRef.current) clearTimeout(drainTimerRef.current);
      if (glowTimerRef.current) clearTimeout(glowTimerRef.current);
    };
  }, []);

  const triggerGlow = () => {
    setIsGlowing(true);
    if (glowTimerRef.current) clearTimeout(glowTimerRef.current);
    glowTimerRef.current = setTimeout(() => setIsGlowing(false), 3000);
  };

  const step = halfRate ? 0.5 : 1;

  const handleXpChange = (delta: number) => {
    const newXp = halfRate ? normalizeHalfStep(xp + delta * step) : Math.max(0, xp + delta * step);
    if (newXp < currentLevelAt) return;
    if (isUpdating) return;

    const currentInfo = getLevelInfo(xp);
    const oldFilled = isMaxLevel ? 1 : xp - currentInfo.currentLevelAt;
    const oldTotal = isMaxLevel ? 1 : (currentInfo.gap ?? 1);

    triggerGlow();
    setXp(newXp);
    setIsUpdating(true);

    const newInfo = getLevelInfo(newXp);
    if (newInfo.currentLevelAt !== currentInfo.currentLevelAt) {
      pendingFillRef.current = {
        filled: newXp - newInfo.currentLevelAt,
        totalSegments: newInfo.gap ?? 1,
      };
      setDraining({ oldFilled: oldFilled + 1, oldTotal });
    }

    onSave(newXp)
      .then((resolvedXp) => setXp(resolvedXp))
      .finally(() => setIsUpdating(false));
  };

  const label = isMaxLevel
    ? "Max Level"
    : `${xp} / ${nextLevelAt} xp`;

  const displayTotal = draining ? draining.oldTotal : totalSegments;
  const displayFilled = draining ? 0 : filled;
  const fullSegments = Math.floor(displayFilled);
  const partialFill = displayFilled - fullSegments;

  return {
    xp,
    isUpdating,
    isGlowing,
    draining,
    label,
    isMaxLevel,
    step,
    displayTotal,
    displayFilled,
    fullSegments,
    partialFill,
    handleXpChange,
    campaignStarted,
  };
}
