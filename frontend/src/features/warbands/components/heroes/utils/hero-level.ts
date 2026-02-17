import {
  DEFAULT_HERO_LEVEL_THRESHOLDS,
  normalizeThresholdList,
} from "@/features/warbands/utils/level-thresholds";

export type LevelInfo = {
  level: number
  nextLevelAt: number | null
  gap: number | null
  currentLevelAt: number
}

export type HeroLevelInfo = LevelInfo

export const getHeroLevelInfo = (
  xpValue: number | null | undefined,
  thresholds?: readonly number[]
): HeroLevelInfo => {
  const xp = Math.max(0, Number(xpValue ?? 0))
  const resolvedThresholds = normalizeThresholdList(thresholds, DEFAULT_HERO_LEVEL_THRESHOLDS)
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

