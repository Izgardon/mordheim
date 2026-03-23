import * as React from "react"

import { Input } from "@/components/ui/input"

type CommittedNumberInputProps = Omit<
  React.ComponentPropsWithoutRef<typeof Input>,
  "type" | "value" | "defaultValue" | "onChange"
> & {
  value: number
  onCommit: (value: number) => void
  min?: number
  max?: number
  fallbackValue?: number
  integer?: boolean
}

const CommittedNumberInput = React.forwardRef<HTMLInputElement, CommittedNumberInputProps>(
  (
    {
      value,
      onCommit,
      min,
      max,
      fallbackValue = 0,
      integer = true,
      inputMode,
      onBlur,
      onFocus,
      onKeyDown,
      ...props
    },
    ref
  ) => {
    const [draftValue, setDraftValue] = React.useState(() => String(value))
    const [isFocused, setIsFocused] = React.useState(false)

    React.useEffect(() => {
      if (!isFocused) {
        setDraftValue(String(value))
      }
    }, [isFocused, value])

    const normalizeValue = React.useCallback(
      (rawValue: string) => {
        const parsed = Number(rawValue)
        let nextValue = Number.isFinite(parsed) ? parsed : fallbackValue

        if (integer) {
          nextValue = Math.trunc(nextValue)
        }
        if (typeof min === "number") {
          nextValue = Math.max(min, nextValue)
        }
        if (typeof max === "number") {
          nextValue = Math.min(max, nextValue)
        }

        return nextValue
      },
      [fallbackValue, integer, max, min]
    )

    const commitValue = React.useCallback(() => {
      const nextValue = normalizeValue(draftValue)
      setDraftValue(String(nextValue))
      onCommit(nextValue)
    }, [draftValue, normalizeValue, onCommit])

    return (
      <Input
        {...props}
        ref={ref}
        type="text"
        inputMode={inputMode ?? (integer ? "numeric" : "decimal")}
        value={draftValue}
        onChange={(event) => setDraftValue(event.target.value)}
        onFocus={(event) => {
          setIsFocused(true)
          onFocus?.(event)
        }}
        onBlur={(event) => {
          setIsFocused(false)
          commitValue()
          onBlur?.(event)
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur()
          }
          onKeyDown?.(event)
        }}
      />
    )
  }
)

CommittedNumberInput.displayName = "CommittedNumberInput"

export { CommittedNumberInput }
