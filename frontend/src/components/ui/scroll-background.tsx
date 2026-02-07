import type { CSSProperties, ReactNode } from "react"
import { useCallback, useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"
import scroll1 from "@/assets/scroll/1.webp"
import scroll2 from "@/assets/scroll/2.webp"
import scroll3 from "@/assets/scroll/3.webp"

const scrollAssets: { ratio: number; src: string }[] = [
  { ratio: 1, src: scroll1 },
  { ratio: 2, src: scroll2 },
  { ratio: 3, src: scroll3 },
]

const findClosestScrollImage = (widthOverHeight: number): string => {
  if (scrollAssets.length === 0) return scroll1

  let closest = scrollAssets[0]
  let minDiff = Math.abs(widthOverHeight - closest.ratio)

  for (const asset of scrollAssets) {
    const diff = Math.abs(widthOverHeight - asset.ratio)
    if (diff < minDiff) {
      minDiff = diff
      closest = asset
    }
  }

  return closest.src
}

type ScrollBackgroundProps = {
  className?: string
  style?: CSSProperties
  children?: ReactNode
}

export function ScrollBackground({
  className,
  style,
  children,
}: ScrollBackgroundProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [backgroundSrc, setBackgroundSrc] = useState(scroll1)

  const updateBackground = useCallback((width: number, height: number) => {
    if (width > 0 && height > 0) {
      const ratio = width / height
      const newSrc = findClosestScrollImage(ratio)
      setBackgroundSrc(newSrc)
    }
  }, [])

  useEffect(() => {
    const node = containerRef.current
    if (!node) return undefined

    // Initial measurement
    const rect = node.getBoundingClientRect()
    updateBackground(rect.width, rect.height)

    // Watch for resize
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      updateBackground(width, height)
    })

    observer.observe(node)

    return () => {
      observer.disconnect()
    }
  }, [updateBackground])

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative shadow-[inset_0_0_28px_rgba(57,255,77,0.22)]",
        className
      )}
      style={{
        backgroundImage: `url(${backgroundSrc})`,
        backgroundSize: "100% 100%",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "local",
        ...style,
      }}
    >
      {children}
    </div>
  )
}
