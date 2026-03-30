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
        "surface-panel relative rounded-lg",
        disableBackground && "bg-card/85",
        className
      )}
      style={style}
    >
      {children}
    </Component>
  )
}
