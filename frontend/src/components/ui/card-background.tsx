import type { CSSProperties, ElementType, ReactNode } from "react"

import { cn } from "@/lib/utils"

type CardBackgroundProps = {
  as?: ElementType
  id?: string
  className?: string
  style?: CSSProperties
  children?: ReactNode
  disableBackground?: boolean
}

export function CardBackground({
  as,
  id,
  className,
  style,
  children,
  disableBackground = false,
}: CardBackgroundProps) {
  const Component = as ?? "div"

  return (
    <Component
      id={id}
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
