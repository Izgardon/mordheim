import * as React from "react"

import checkedImage from "@/assets/components/checked.png"
import uncheckedImage from "@/assets/components/unchecked.png"

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
        <img
          src={checked ? checkedImage : uncheckedImage}
          alt=""
          aria-hidden="true"
          className="pointer-events-none h-full w-full object-contain"
        />
      </span>
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
