import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

type ExitIconProps = React.HTMLAttributes<SVGSVGElement> & {
  alt?: string;
}

function ExitIcon({ className, ...props }: ExitIconProps) {
  return (
    <X
      aria-hidden="true"
      className={cn("h-8 w-8", className)}
      {...props}
    />
  )
}

export { ExitIcon }
