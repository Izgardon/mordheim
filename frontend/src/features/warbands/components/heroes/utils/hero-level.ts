const HERO_LEVEL_THRESHOLDS = [
  2, 4, 6, 8, 11, 14, 17, 20, 24, 28, 32, 36, 41, 46, 51, 56, 62, 68, 74, 80,
  87, 94, 101, 108, 116, 124, 132, 140, 149, 158, 167, 176, 186, 196, 206, 216,
  227, 238, 249, 260, 272, 284, 296, 308, 321, 334, 347, 360, 374, 388,
] as const

export type LevelInfo = {
  level: number
  nextLevelAt: number | null
  gap: number | null
  currentLevelAt: number
}

export type HeroLevelInfo = LevelInfo

export const getHeroLevelInfo = (xpValue: number | null | undefined): HeroLevelInfo => {
  const xp = Math.max(0, Number(xpValue ?? 0))
  const nextIndex = HERO_LEVEL_THRESHOLDS.findIndex((threshold) => xp < threshold)

  if (nextIndex === -1) {
    const lastThreshold = HERO_LEVEL_THRESHOLDS[HERO_LEVEL_THRESHOLDS.length - 1]
    return {
      level: HERO_LEVEL_THRESHOLDS.length + 1,
      nextLevelAt: null,
      gap: null,
      currentLevelAt: lastThreshold,
    }
  }

  const nextLevelAt = HERO_LEVEL_THRESHOLDS[nextIndex]
  const prevThreshold = nextIndex === 0 ? 0 : HERO_LEVEL_THRESHOLDS[nextIndex - 1]

  return {
    level: nextIndex + 1,
    nextLevelAt,
    gap: nextLevelAt - prevThreshold,
    currentLevelAt: prevThreshold,
  }
}

