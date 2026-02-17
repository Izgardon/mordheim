import type { LevelInfo } from "../components/heroes/utils/hero-level"
import {
  DEFAULT_HENCHMEN_LEVEL_THRESHOLDS,
  normalizeThresholdList,
} from "@/features/warbands/utils/level-thresholds";

export type HenchmenLevelInfo = LevelInfo

export const getHenchmenLevelInfo = (
  xpValue: number | null | undefined,
  thresholds?: readonly number[]
): HenchmenLevelInfo => {
  const xp = Math.max(0, Math.floor(Number(xpValue ?? 0)))
  const resolvedThresholds = normalizeThresholdList(thresholds, DEFAULT_HENCHMEN_LEVEL_THRESHOLDS)
  const nextIndex = resolvedThresholds.findIndex((threshold) => xp < threshold)

  if (nextIndex === -1) {
    const lastThreshold = resolvedThresholds[resolvedThresholds.length - 1] ?? 0
    return {
      level: resolvedThresholds.length + 1,
      nextLevelAt: null,
      gap: null,
      currentLevelAt: lastThreshold,
    }
  }

  const nextLevelAt = resolvedThresholds[nextIndex]
  const prevThreshold = nextIndex === 0 ? 0 : resolvedThresholds[nextIndex - 1]

  return {
    level: nextIndex + 1,
    nextLevelAt,
    gap: nextLevelAt - prevThreshold,
    currentLevelAt: prevThreshold,
  }
}
