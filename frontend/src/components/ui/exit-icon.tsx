import * as React from "react"

import exitIcon from "@/assets/components/exit.webp"
import { cn } from "@/lib/utils"

type ExitIconProps = Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src">

function ExitIcon({ className, alt = "", ...props }: ExitIconProps) {
  return (
    <img
      src={exitIcon}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      className={cn("h-8 w-8", className)}
      {...props}
    />
  )
}

export { ExitIcon }
