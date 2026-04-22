import * as React from "react"
import { Minus, Plus } from "lucide-react"

import basicBar from "@/assets/containers/basic_bar.webp"
import { useMediaQuery } from "@/lib/use-media-query"

// components
import { Input } from "@components/input"

// utils
import { cn } from "@/lib/utils"

type NumberInputProps = Omit<React.ComponentPropsWithoutRef<"input">, "type"> & {
  containerClassName?: string
  buttonClassName?: string
  stepButtonsTabIndex?: number
  allowEmpty?: boolean
  inputSize?: "sm" | "default" | "lg"
  /** When true the mobile layout uses w-auto instead of w-full so the input only takes the space it needs. */
  compact?: boolean
  mobileButtonVariant?: "image" | "solid"
}

const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  (
    {
      className,
      containerClassName,
      buttonClassName,
      stepButtonsTabIndex = 0,
      disabled,
      readOnly,
      allowEmpty = false,
      inputSize = "default",
      compact = false,
      mobileButtonVariant = "solid",
      value,
      onChange,
      onFocus,
      onBlur,
      ...props
    },
    ref
  ) => {
    const inputRef = React.useRef<HTMLInputElement | null>(null)
    const suppressNextClickRef = React.useRef(false)
    const isDisabled = Boolean(disabled || readOnly)
    const isMobile = useMediaQuery("(max-width: 960px)")
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

    const handleStep = (direction: "up" | "down", focus = true) => {
      if (!inputRef.current || isDisabled) {
        return
      }
      if (direction === "up") {
        inputRef.current.stepUp()
      } else {
        inputRef.current.stepDown()
      }
      dispatchInput()
      if (focus) {
        inputRef.current.focus()
      }
    }

    const handleStepPointerDown =
      (direction: "up" | "down") => (event: React.PointerEvent<HTMLButtonElement>) => {
        if (event.pointerType === "touch" || event.pointerType === "pen") {
          event.preventDefault()
          suppressNextClickRef.current = true
          handleStep(direction, false)
        }
      }

    const handleStepClick = (direction: "up" | "down") => {
      if (suppressNextClickRef.current) {
        suppressNextClickRef.current = false
        return
      }
      handleStep(direction)
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

    const mobileButtonStyle: React.CSSProperties | undefined =
      mobileButtonVariant === "image"
        ? {
            backgroundImage: `url(${basicBar})`,
            backgroundSize: "100% 100%",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center",
          }
        : undefined
    const mobileHeightClass =
      inputSize === "sm" ? "h-8" : inputSize === "lg" ? "h-10" : "h-9"
    const mobileButtonWidthClass =
      inputSize === "sm" ? "w-8" : inputSize === "lg" ? "w-10" : "w-9"
    const mobileIconClass =
      inputSize === "sm"
        ? "h-3.5 w-3.5 theme-accent"
        : inputSize === "lg"
          ? "h-5 w-5 theme-accent"
          : "size-4 theme-accent"
    const mobileButtonBaseClass =
      mobileButtonVariant === "image"
        ? "icon-button flex h-full shrink-0 items-center justify-center rounded-none border border-transparent bg-transparent shadow-none transition-[filter] hover:brightness-125 disabled:cursor-not-allowed disabled:opacity-60"
        : "flex h-full shrink-0 items-center justify-center rounded-none border border-border bg-black text-foreground shadow-none transition-colors hover:bg-[#120e0a] disabled:cursor-not-allowed disabled:opacity-60"
    const desktopButtonWidthClass =
      inputSize === "sm" ? "w-7" : inputSize === "lg" ? "w-9" : "w-8"
    const desktopIconClass =
      inputSize === "sm"
        ? "h-3.5 w-3.5 theme-accent"
        : inputSize === "lg"
          ? "h-5 w-5 theme-accent"
          : "h-4 w-4 theme-accent"

    if (isMobile) {
      return (
        <div
          className={cn(
            "flex items-stretch overflow-hidden rounded-[6px]",
            compact ? "w-fit shrink-0" : "w-full max-w-[50vw]",
            mobileHeightClass,
            containerClassName
          )}
        >
          <button
            type="button"
            aria-label="Decrease value"
            onPointerDown={handleStepPointerDown("down")}
            onClick={() => handleStepClick("down")}
            disabled={isDisabled}
            tabIndex={stepButtonsTabIndex}
            className={cn(
              mobileButtonBaseClass,
              mobileButtonWidthClass,
              buttonClassName
            )}
            style={mobileButtonStyle}
          >
            <Minus aria-hidden="true" className={mobileIconClass} />
          </button>

          <Input
            ref={inputRef}
            type="number"
            inputSize={inputSize}
            disabled={disabled}
            readOnly={readOnly}
            value={allowEmpty ? displayValue : value}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            className={cn(
              "h-full min-h-0 rounded-none bg-transparent !px-0 !text-center tabular-nums shadow-none appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
              compact ? "w-10" : "flex-1",
              className
            )}
            {...props}
          />

          <button
            type="button"
            aria-label="Increase value"
            onPointerDown={handleStepPointerDown("up")}
            onClick={() => handleStepClick("up")}
            disabled={isDisabled}
            tabIndex={stepButtonsTabIndex}
            className={cn(
              mobileButtonBaseClass,
              mobileButtonWidthClass,
              buttonClassName
            )}
            style={mobileButtonStyle}
          >
            <Plus aria-hidden="true" className={mobileIconClass} />
          </button>
        </div>
      )
    }

    return (
      <div className={cn("flex items-stretch overflow-visible", containerClassName)}>
        <Input
          ref={inputRef}
          type="number"
          inputSize={inputSize}
          disabled={disabled}
          readOnly={readOnly}
          value={allowEmpty ? displayValue : value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className={cn(
            "min-w-0 flex-1 bg-transparent appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
            className
          )}
          {...props}
        />
        <div className={cn("-ml-[2px] flex flex-col overflow-hidden rounded-r-sm border border-border bg-black", desktopButtonWidthClass)}>
          <button
            type="button"
            aria-label="Increase value"
            onClick={() => handleStep("up")}
            disabled={isDisabled}
            tabIndex={stepButtonsTabIndex}
            className={cn(
              "relative flex flex-1 items-center justify-center border-b border-border bg-black text-foreground shadow-none transition-colors hover:bg-[#120e0a] disabled:cursor-not-allowed disabled:opacity-60",
              buttonClassName
            )}
          >
            <Plus aria-hidden="true" className={desktopIconClass} />
          </button>
          <button
            type="button"
            aria-label="Decrease value"
            onClick={() => handleStep("down")}
            disabled={isDisabled}
            tabIndex={stepButtonsTabIndex}
            className={cn(
              "relative flex flex-1 items-center justify-center bg-black text-foreground shadow-none transition-colors hover:bg-[#120e0a] disabled:cursor-not-allowed disabled:opacity-60",
              buttonClassName
            )}
          >
            <Minus aria-hidden="true" className={desktopIconClass} />
          </button>
        </div>
      </div>
    )
  }
)

NumberInput.displayName = "NumberInput"

export { NumberInput }
