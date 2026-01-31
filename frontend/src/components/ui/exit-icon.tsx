import * as React from "react"

import exitIcon from "@/assets/components/exit.png"
import exitHoverIcon from "@/assets/components/exit_hover.png"
import { cn } from "@/lib/utils"

type ExitIconProps = Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  hoverSrc?: string
}

function ExitIcon({ className, alt = "", hoverSrc = exitHoverIcon, ...props }: ExitIconProps) {
  const [isHovering, setIsHovering] = React.useState(false)
  return (
    <img
      src={isHovering ? hoverSrc : exitIcon}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      className={cn("h-8 w-8", className)}
      onMouseEnter={(event) => {
        setIsHovering(true)
        props.onMouseEnter?.(event)
      }}
      onMouseLeave={(event) => {
        setIsHovering(false)
        props.onMouseLeave?.(event)
      }}
      onFocus={(event) => {
        setIsHovering(true)
        props.onFocus?.(event)
      }}
      onBlur={(event) => {
        setIsHovering(false)
        props.onBlur?.(event)
      }}
      {...props}
    />
  )
}

export { ExitIcon }
