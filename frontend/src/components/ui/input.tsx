import * as React from "react"

import basicBar from "@/assets/containers/basic_bar.webp"

// utils
import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, style, ...props }, ref) => {
    const mergedStyle: React.CSSProperties = {
      backgroundImage: `url(${basicBar})`,
      backgroundSize: "100% 100%",
      backgroundRepeat: "no-repeat",
      backgroundPosition: "center",
      ...style,
    }

    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-[6px] border border-transparent bg-transparent px-4 py-2 text-sm font-medium text-foreground shadow-[0_10px_20px_rgba(12,7,3,0.35)] transition-colors file:bg-transparent placeholder:text-muted-foreground/70 placeholder:italic focus-visible:outline-none focus-visible:shadow-[0_10px_20px_rgba(12,7,3,0.35),inset_0_0_0_2px_hsl(var(--ring)_/_0.65)] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={ref}
        style={mergedStyle}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"
export { Input }
