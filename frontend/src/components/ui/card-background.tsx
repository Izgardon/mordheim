import type { CSSProperties, ElementType, ReactNode } from "react"
import { useEffect, useMemo, useRef, useState } from "react"

import { cn } from "@/lib/utils"
import ratio1Short from "@/assets/card_background/1_short.png"
import ratio2 from "@/assets/card_background/2.png"
import ratio2Short from "@/assets/card_background/2_short.png"
import ratio2Long from "@/assets/card_background/2_long.png"
import ratio3Long from "@/assets/card_background/3_long.png"
import ratio4Long from "@/assets/card_background/4_long.png"
import vertical1Short from "@/assets/card_background/vertical_1_short.png"
import vertical2 from "@/assets/card_background/vertical_2.png"
import vertical2Long from "@/assets/card_background/vertical_2_long.png"
import vertical3Long from "@/assets/card_background/vertical_3_long.png"

type WidthImage = {
  minWidth: number
  src: string
}

type RatioImageSet = {
  images: WidthImage[]
  minRatio?: number
  maxRatio?: number
  fallbackSrc?: string
  isDefault?: boolean
}

type CardBackgroundProps = {
  ratioSets?: RatioImageSet[]
  fallbackSrc?: string
  as?: ElementType
  className?: string
  style?: CSSProperties
  backgroundSize?: string
  backgroundPosition?: string
  backgroundRepeat?: string
  children?: ReactNode
}

const matchesRatio = (ratio: number, set: RatioImageSet) => {
  const meetsMin = set.minRatio === undefined || ratio >= set.minRatio
  const meetsMax = set.maxRatio === undefined || ratio <= set.maxRatio
  return meetsMin && meetsMax
}

const resolveImage = (images: WidthImage[], width: number) => {
  if (images.length === 0) {
    return undefined
  }

  const sorted = [...images].sort((a, b) => a.minWidth - b.minWidth)
  let selected = sorted[0]

  for (const candidate of sorted) {
    if (width >= candidate.minWidth) {
      selected = candidate
    }
  }

  return selected?.src
}

type LengthKey = "short" | "normal" | "long"
type OrientationKey = "horizontal" | "vertical"

const ratioAssets: Record<OrientationKey, Record<number, Partial<Record<LengthKey, string>>>> =
  {
    horizontal: {
      1: { short: ratio1Short },
      2: { short: ratio2Short, normal: ratio2, long: ratio2Long },
      3: { long: ratio3Long },
      4: { long: ratio4Long },
    },
    vertical: {
      1: { short: vertical1Short },
      2: { normal: vertical2, long: vertical2Long },
      3: { long: vertical3Long },
    },
  }

const lengthFallbacks: Record<LengthKey, LengthKey[]> = {
  long: ["normal", "short"],
  normal: ["long", "short"],
  short: ["normal", "long"],
}

const getLengthKey = (ratio: number, size: { width: number; height: number }, viewport: { width: number; height: number }): LengthKey => {
  if (viewport.width === 0 || viewport.height === 0) {
    return "normal"
  }

  const isVertical = ratio < 1
  const fraction = isVertical
    ? size.height / viewport.height
    : size.width / viewport.width

  if (fraction >= 0.75) return "long"
  if (fraction >= 0.4) return "normal"
  return "short"
}

const listRatiosByCloseness = (orientation: OrientationKey, target: number) => {
  const available = Object.keys(ratioAssets[orientation])
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b)

  if (available.length === 0) return []

  return available.sort((a, b) => Math.abs(target - a) - Math.abs(target - b))
}

const resolveRatioImage = (
  orientation: OrientationKey,
  ratioValue: number,
  length: LengthKey
) => {
  const candidates = listRatiosByCloseness(orientation, ratioValue)
  if (candidates.length === 0) return undefined

  // For vertical containers, prioritize longest height first (long > normal > short)
  // For horizontal containers, prioritize longest width first (long > normal > short)
  const lengthPriority: LengthKey[] = ["long", "normal", "short"]

  // First, try to find any image with the longest length across all ratios
  for (const lengthKey of lengthPriority) {
    for (const ratio of candidates) {
      const ratioMap = ratioAssets[orientation][ratio]
      if (!ratioMap) continue
      const candidate = ratioMap[lengthKey]
      if (candidate) return candidate
    }
  }

  // Fallback to any available image
  const closestRatio = candidates[0]
  const closestMap = ratioAssets[orientation][closestRatio]
  return closestMap?.normal ?? closestMap?.long ?? closestMap?.short
}

export function CardBackground({
  ratioSets,
  fallbackSrc,
  as,
  className,
  style,
  backgroundSize = "100% 100%",
  backgroundPosition = "center",
  backgroundRepeat = "no-repeat",
  children,
}: CardBackgroundProps) {
  const containerRef = useRef<HTMLElement | null>(null)
  const Component = as ?? "div"
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [viewport, setViewport] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const node = containerRef.current
    if (!node) return undefined

    let frame = 0
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect

      if (frame) {
        cancelAnimationFrame(frame)
      }
      frame = requestAnimationFrame(() => {
        setSize((prev) =>
          prev.width === width && prev.height === height
            ? prev
            : { width, height }
        )
      })
    })

    observer.observe(node)

    return () => {
      if (frame) {
        cancelAnimationFrame(frame)
      }
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return undefined

    const updateViewport = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight })
    }

    updateViewport()
    window.addEventListener("resize", updateViewport)

    return () => {
      window.removeEventListener("resize", updateViewport)
    }
  }, [])

  const ratio = size.height > 0 ? size.width / size.height : undefined

  const ratioSet = useMemo(() => {
    if (!ratioSets || ratioSets.length === 0) return undefined
    if (ratio === undefined) {
      return ratioSets.find((set) => set.isDefault) ?? ratioSets[0]
    }

    return (
      ratioSets.find((set) => matchesRatio(ratio, set)) ??
      ratioSets.find((set) => set.isDefault) ??
      ratioSets[0]
    )
  }, [ratio, ratioSets])

  const backgroundSrc = useMemo(() => {
    if (!ratioSet) {
      if (!ratio) return fallbackSrc
      const orientation: OrientationKey = ratio < 1 ? "vertical" : "horizontal"
      const ratioValue = orientation === "vertical" ? 1 / ratio : ratio
      const lengthKey = getLengthKey(ratio, size, viewport)

      return (
        resolveRatioImage(orientation, ratioValue, lengthKey) ?? fallbackSrc
      )
    }

    return (
      resolveImage(ratioSet.images, size.width) ??
      ratioSet.fallbackSrc ??
      fallbackSrc
    )
  }, [fallbackSrc, ratioSet, ratio, size, viewport])

  return (
    <Component
      ref={containerRef}
      className={cn("relative", className)}
      style={{
        backgroundImage: backgroundSrc ? `url(${backgroundSrc})` : undefined,
        backgroundSize,
        backgroundPosition,
        backgroundRepeat,
        ...style,
      }}
    >
      {children}
    </Component>
  )
}
