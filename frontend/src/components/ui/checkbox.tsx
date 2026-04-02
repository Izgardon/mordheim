import * as React from "react"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

type CheckboxProps = Omit<React.ComponentProps<"input">, "type"> & {
  checked?: boolean
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, disabled, ...props }, ref) => {
    return (
      <span
        className={cn(
          "relative inline-flex h-5 w-5 shrink-0 items-center justify-center",
          disabled && "cursor-not-allowed opacity-50",
          className
        )}
      >
        <input
          type="checkbox"
          ref={ref}
          checked={checked}
          disabled={disabled}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          {...props}
        />
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none flex h-full w-full items-center justify-center rounded-[0.28rem] border transition-[background-color,border-color,color,box-shadow] duration-150",
            checked
              ? "border-[#8f7440] bg-[#5f4922] text-[#ead9a8] shadow-[0_0_0_1px_rgba(143,116,64,0.08)]"
              : "border-border/70 bg-[color:var(--color-surface-inline)] text-transparent"
          )}
        >
          <Check className="h-3.5 w-3.5" />
        </span>
      </span>
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
