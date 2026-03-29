import type { CSSProperties, ElementType, ReactNode } from "react"

import { cn } from "@/lib/utils"

type CardBackgroundProps = {
  as?: ElementType
  className?: string
  style?: CSSProperties
  children?: ReactNode
  disableBackground?: boolean
}

export function CardBackground({
  as,
  className,
  style,
  children,
  disableBackground = false,
}: CardBackgroundProps) {
  const Component = as ?? "div"

  return (
    <Component
      className={cn(
        "relative rounded-lg border border-border/70 bg-card/85 shadow-[0_18px_32px_rgba(6,4,2,0.28)]",
        disableBackground && "bg-card/85",
        className
      )}
      style={style}
    >
      {children}
    </Component>
  )
}
