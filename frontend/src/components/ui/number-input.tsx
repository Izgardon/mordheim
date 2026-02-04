import * as React from "react"

import plusIcon from "@/assets/components/plus.png"
import plusHoverIcon from "@/assets/components/plus_hover.png"
import minusIcon from "@/assets/components/minus.png"
import minusHoverIcon from "@/assets/components/minus_hover.png"

// components
import { Input } from "@components/input"

// utils
import { cn } from "@/lib/utils"

type NumberInputProps = Omit<React.ComponentPropsWithoutRef<"input">, "type"> & {
  containerClassName?: string
  buttonClassName?: string
}

const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ className, containerClassName, buttonClassName, disabled, readOnly, ...props }, ref) => {
    const inputRef = React.useRef<HTMLInputElement | null>(null)
    const isDisabled = Boolean(disabled || readOnly)

    React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)

    const dispatchInput = () => {
      if (!inputRef.current) {
        return
      }
      const event = new Event("input", { bubbles: true })
      inputRef.current.dispatchEvent(event)
    }

    const handleStep = (direction: "up" | "down") => {
      if (!inputRef.current || isDisabled) {
        return
      }
      if (direction === "up") {
        inputRef.current.stepUp()
      } else {
        inputRef.current.stepDown()
      }
      dispatchInput()
      inputRef.current.focus()
    }

    return (
      <div className={cn("relative", containerClassName)}>
        <Input
          ref={inputRef}
          type="number"
          disabled={disabled}
          readOnly={readOnly}
          className={cn(
            "pr-10 bg-transparent appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
            className
          )}
          {...props}
        />
        <div className="absolute right-0.5 top-1/2 flex -translate-y-1/2 flex-col">
          <button
            type="button"
            aria-label="Increase value"
            onClick={() => handleStep("up")}
            disabled={isDisabled}
            className={cn(
              "icon-button group relative flex h-[20px] w-[20px] items-center justify-center disabled:cursor-not-allowed disabled:opacity-60",
              buttonClassName
            )}
          >
            <img
              src={plusIcon}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-contain transition-opacity group-hover:opacity-0"
            />
            <img
              src={plusHoverIcon}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-contain opacity-0 transition-opacity group-hover:opacity-100"
            />
          </button>
          <button
            type="button"
            aria-label="Decrease value"
            onClick={() => handleStep("down")}
            disabled={isDisabled}
            className={cn(
              "icon-button group relative flex h-[20px] w-[20px] items-center justify-center disabled:cursor-not-allowed disabled:opacity-60",
              buttonClassName
            )}
          >
            <img
              src={minusIcon}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-contain transition-opacity group-hover:opacity-0"
            />
            <img
              src={minusHoverIcon}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-contain opacity-0 transition-opacity group-hover:opacity-100"
            />
          </button>
        </div>
      </div>
    )
  }
)

NumberInput.displayName = "NumberInput"

export { NumberInput }
