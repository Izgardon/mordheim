import * as React from "react"

import basicBar from "@/assets/containers/basic_bar.webp"

// utils
import { cn } from "@/lib/utils"

type InputSize = "sm" | "default" | "lg"

type InputProps = React.ComponentProps<"input"> & {
  inputSize?: InputSize
}

const inputSizeClasses: Record<InputSize, string> = {
  sm: "h-8 px-3 py-1.5 text-xs md:h-9",
  default: "h-9 px-4 py-2 text-sm md:h-11",
  lg: "h-10 px-4 py-2 text-base md:h-12",
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, style, inputSize = "default", ...props }, ref) => {
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
          "flex w-full rounded-[6px] border border-transparent bg-transparent font-medium text-foreground shadow-[0_10px_20px_rgba(12,7,3,0.35)] transition-colors file:bg-transparent placeholder:text-muted-foreground/70 placeholder:italic focus-visible:outline-none focus-visible:shadow-[0_10px_20px_rgba(12,7,3,0.35),inset_0_0_0_1px_rgba(57,255,77,0.25),inset_0_0_20px_rgba(57,255,77,0.2)] disabled:cursor-not-allowed disabled:opacity-50",
          inputSizeClasses[inputSize],
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
