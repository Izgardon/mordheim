import { useState } from "react";

import { useExperienceBar } from "../../../hooks/shared/useExperienceBar";
import { useMediaQuery } from "@/lib/use-media-query";

import type { LevelInfo } from "../../heroes/utils/hero-level";

type ExperienceBarProps = {
  xp: number | null;
  halfRate?: boolean;
  getLevelInfo: (xp: number) => LevelInfo;
  onSave: (newXp: number) => Promise<number>;
};

const DRAIN_STEP_MS = 200;

export default function ExperienceBar({ xp: initialXp, halfRate, getLevelInfo, onSave }: ExperienceBarProps) {
  const [isHovered, setIsHovered] = useState(false);
  const isMobile = useMediaQuery("(max-width: 960px)");

  const {
    xp,
    isUpdating,
    isGlowing,
    draining,
    label,
    isMaxLevel,
    displayTotal,
    fullSegments,
    partialFill,
    handleXpChange,
    campaignStarted,
  } = useExperienceBar({ xp: initialXp, halfRate, getLevelInfo, onSave });

  const currentLevelAt = getLevelInfo(xp).currentLevelAt;
  const showControls = isMobile || isHovered;
  const showLabel = isMobile || isHovered;
  const disableAdjust = !campaignStarted;

  return (
    <div
      className="relative py-2"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={!campaignStarted ? "Campaign hasn't started yet" : undefined}
    >
      {showLabel && (
        <p
          className={
            isMobile
              ? "mb-1 text-center text-[10px] tracking-wide text-amber-200/80"
              : "absolute -top-2 left-0 right-0 z-10 text-center text-[10px] tracking-wide text-amber-200/80"
          }
        >
          {label}
        </p>
      )}

      <div className="relative flex items-center gap-0.5 overflow-visible">
        {showControls && !isMaxLevel && (
          <button
            type="button"
            disabled={disableAdjust || isUpdating || xp <= currentLevelAt}
            onClick={() => handleXpChange(-1)}
            className={
              isMobile
                ? "absolute -left-2 z-10 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-stone-700 text-xs font-bold text-amber-200 shadow-none transition-colors hover:bg-stone-600 disabled:cursor-not-allowed disabled:opacity-40"
                : "absolute -left-2 z-10 flex h-4 w-4 cursor-pointer items-center justify-center rounded-full bg-stone-700 text-[10px] font-bold text-amber-200 transition-colors hover:bg-stone-600 disabled:cursor-not-allowed disabled:opacity-40"
            }
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

        {showControls && !isMaxLevel && (
          <button
            type="button"
            disabled={disableAdjust || isUpdating}
            onClick={() => handleXpChange(1)}
            className={
              isMobile
                ? "absolute -right-2 z-10 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-stone-700 text-xs font-bold text-amber-200 shadow-none transition-colors hover:bg-stone-600 disabled:cursor-not-allowed disabled:opacity-40"
                : "absolute -right-2 z-10 flex h-4 w-4 cursor-pointer items-center justify-center rounded-full bg-stone-700 text-[10px] font-bold text-amber-200 transition-colors hover:bg-stone-600 disabled:cursor-not-allowed disabled:opacity-40"
            }
          >
            +
          </button>
        )}
      </div>
    </div>
  );
}
