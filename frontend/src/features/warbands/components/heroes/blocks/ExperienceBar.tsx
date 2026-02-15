import { useEffect, useRef, useState } from "react";

import { useAppStore } from "@/stores/app-store";

import type { LevelInfo } from "../utils/hero-level";

type ExperienceBarProps = {
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

export default function ExperienceBar({ xp: initialXp, halfRate, getLevelInfo, onSave }: ExperienceBarProps) {
  const { campaignStarted } = useAppStore();
  const [xp, setXp] = useState(() => toNumber(initialXp));
  const [isHovered, setIsHovered] = useState(false);
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

  return (
    <div
      className="relative py-2"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={!campaignStarted ? "Campaign hasn't started yet" : undefined}
    >
      {isHovered && (
        <p className="absolute -top-2 left-0 right-0 z-10 text-center text-[10px] tracking-wide text-amber-200/80">
          {label}
        </p>
      )}

      <div className="relative flex items-center gap-0.5 overflow-visible">
        {isHovered && !isMaxLevel && campaignStarted && (
          <button
            type="button"
            disabled={isUpdating || xp <= currentLevelAt}
            onClick={() => handleXpChange(-1)}
            className="absolute -left-2 z-10 flex h-4 w-4 cursor-pointer items-center justify-center rounded-full bg-stone-700 text-[10px] font-bold text-amber-200 transition-colors hover:bg-stone-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            -
          </button>
        )}

        <div className={`flex w-full gap-[2px] overflow-visible transition-[filter] duration-1000 ${isGlowing ? "drop-shadow-[0_0_14px_rgba(52,211,153,0.9)]" : "drop-shadow-[0_0_4px_rgba(52,211,153,0.4)]"}`}>
          {Array.from({ length: displayTotal }).map((_, i) => {
            const fillRatio =
              i < fullSegments ? 1 : i === fullSegments ? partialFill : 0;
            const isFilled = fillRatio > 0;
            const isFirst = i === 0;
            const isLast = i === displayTotal - 1;
            const borderRadius = `${isFirst ? "9999px" : "0"} ${isLast ? "9999px" : "0"} ${isLast ? "9999px" : "0"} ${isFirst ? "9999px" : "0"}`;

            let transitionDelay = "0ms";
            if (draining) {
              const distFromRight = draining.oldFilled - 1 - i;
              if (distFromRight >= 0) {
                transitionDelay = `${distFromRight * DRAIN_STEP_MS}ms`;
              }
            }

            return (
              <div
                key={i}
                className="relative h-1.5 flex-1 overflow-hidden bg-stone-700/60"
                style={{ borderRadius }}
              >
                <div
                  className={`absolute inset-y-0 left-0 w-full bg-emerald-400 transition-[transform] duration-500 ease-out ${
                    isFilled ? "shadow-[0_0_8px_rgba(52,211,153,0.7)]" : ""
                  }`}
                  style={{
                    borderRadius,
                    transitionDelay,
                    transform: `scaleX(${fillRatio})`,
                    transformOrigin: "left",
                  }}
                />
              </div>
            );
          })}
        </div>

        {isHovered && !isMaxLevel && campaignStarted && (
          <button
            type="button"
            disabled={isUpdating}
            onClick={() => handleXpChange(1)}
            className="absolute -right-2 z-10 flex h-4 w-4 cursor-pointer items-center justify-center rounded-full bg-stone-700 text-[10px] font-bold text-amber-200 transition-colors hover:bg-stone-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            +
          </button>
        )}
      </div>
    </div>
  );
}
