import * as React from "react"

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
          className={cn("rpg-number-input pr-12", className)}
          {...props}
        />
        <div className="rpg-number-controls">
          <button
            type="button"
            aria-label="Increase value"
            onClick={() => handleStep("up")}
            disabled={isDisabled}
            className={cn("rpg-number-button", buttonClassName)}
          >
            <img src="/assets/Classic_RPG_UI/Plus.png" alt="" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Decrease value"
            onClick={() => handleStep("down")}
            disabled={isDisabled}
            className={cn("rpg-number-button", buttonClassName)}
          >
            <img src="/assets/Classic_RPG_UI/Minus.png" alt="" aria-hidden="true" />
          </button>
        </div>
      </div>
    )
  }
)

NumberInput.displayName = "NumberInput"

export { NumberInput }
