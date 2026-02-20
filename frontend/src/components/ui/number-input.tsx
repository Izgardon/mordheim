import * as React from "react"

import plusIcon from "@/assets/components/plus.webp"
import minusIcon from "@/assets/components/minus.webp"

// components
import { Input } from "@components/input"

// utils
import { cn } from "@/lib/utils"

type NumberInputProps = Omit<React.ComponentPropsWithoutRef<"input">, "type"> & {
  containerClassName?: string
  buttonClassName?: string
  allowEmpty?: boolean
}

const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  (
    {
      className,
      containerClassName,
      buttonClassName,
      disabled,
      readOnly,
      allowEmpty = false,
      value,
      onChange,
      onFocus,
      onBlur,
      ...props
    },
    ref
  ) => {
    const inputRef = React.useRef<HTMLInputElement | null>(null)
    const isDisabled = Boolean(disabled || readOnly)
    const [isFocused, setIsFocused] = React.useState(false)
    const [displayValue, setDisplayValue] = React.useState<string>(
      value === undefined || value === null ? "" : String(value)
    )

    React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)

    React.useEffect(() => {
      if (!allowEmpty || !isFocused) {
        setDisplayValue(value === undefined || value === null ? "" : String(value))
      }
    }, [allowEmpty, isFocused, value])

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

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (allowEmpty) {
        setDisplayValue(event.target.value)
      }
      onChange?.(event)
    }

    const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true)
      onFocus?.(event)
    }

    const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false)
      onBlur?.(event)
    }

    return (
      <div className={cn("relative", containerClassName)}>
        <Input
          ref={inputRef}
          type="number"
          disabled={disabled}
          readOnly={readOnly}
          value={allowEmpty ? displayValue : value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
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
              "icon-button relative flex h-[20px] w-[20px] items-center justify-center transition-[filter] hover:brightness-125 disabled:cursor-not-allowed disabled:opacity-60",
              buttonClassName
            )}
          >
            <img src={plusIcon} alt="" aria-hidden="true" className="h-full w-full object-contain" />
          </button>
          <button
            type="button"
            aria-label="Decrease value"
            onClick={() => handleStep("down")}
            disabled={isDisabled}
            className={cn(
              "icon-button relative flex h-[20px] w-[20px] items-center justify-center transition-[filter] hover:brightness-125 disabled:cursor-not-allowed disabled:opacity-60",
              buttonClassName
            )}
          >
            <img src={minusIcon} alt="" aria-hidden="true" className="h-full w-full object-contain" />
          </button>
        </div>
      </div>
    )
  }
)

NumberInput.displayName = "NumberInput"

export { NumberInput }
