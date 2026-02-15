import type { LevelInfo } from "../components/heroes/utils/hero-level"

const HENCHMEN_LEVEL_THRESHOLDS = [2, 5, 9, 14] as const

export type HenchmenLevelInfo = LevelInfo

export const getHenchmenLevelInfo = (xpValue: number | null | undefined): HenchmenLevelInfo => {
  const xp = Math.max(0, Math.floor(Number(xpValue ?? 0)))
  const nextIndex = HENCHMEN_LEVEL_THRESHOLDS.findIndex((threshold) => xp < threshold)

  if (nextIndex === -1) {
    const lastThreshold = HENCHMEN_LEVEL_THRESHOLDS[HENCHMEN_LEVEL_THRESHOLDS.length - 1]
    return {
      level: HENCHMEN_LEVEL_THRESHOLDS.length + 1,
      nextLevelAt: null,
      gap: null,
      currentLevelAt: lastThreshold,
    }
  }

  const nextLevelAt = HENCHMEN_LEVEL_THRESHOLDS[nextIndex]
  const prevThreshold = nextIndex === 0 ? 0 : HENCHMEN_LEVEL_THRESHOLDS[nextIndex - 1]

  return {
    level: nextIndex + 1,
    nextLevelAt,
    gap: nextLevelAt - prevThreshold,
    currentLevelAt: prevThreshold,
  }
}
