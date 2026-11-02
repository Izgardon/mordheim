import * as React from "react";
import { Minus, Plus } from "lucide-react";

// components
import { Input } from "@components/input";

// utils
import { cn } from "@/lib/utils";

type NumberInputProps = Omit<React.ComponentPropsWithoutRef<"input">, "type"> & {
  containerClassName?: string;
  buttonClassName?: string;
  stepButtonsTabIndex?: number;
  /** While focused the box may be emptied (the value only follows `value` once it blurs). */
  allowEmpty?: boolean;
  inputSize?: "sm" | "default" | "lg";
  /** Only as wide as its number needs, instead of filling its column. */
  compact?: boolean;
  /** + above the box and − below it, for a row of narrow boxes (a profile). */
  vertical?: boolean;
};

const HEIGHT = { sm: "h-9", default: "h-9 md:h-11", lg: "h-10 md:h-12" } as const;

/**
 * A number field with − and + attached (William: "immediate plus minus buttons on them for quick
 * changes"): they step by `step` within `min` and `max`, as the arrow keys do, and on a phone
 * each is at least 36 px wide. Typing still works; an empty box is the caller's to read.
 */
const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  (
    {
      className,
      containerClassName,
      buttonClassName,
      stepButtonsTabIndex = -1,
      disabled,
      readOnly,
      allowEmpty = false,
      inputSize = "default",
      compact = false,
      vertical = false,
      value,
      onChange,
      onFocus,
      onBlur,
      ...props
    },
    ref
  ) => {
    const inputRef = React.useRef<HTMLInputElement | null>(null);
    const isDisabled = Boolean(disabled || readOnly);
    const [isFocused, setIsFocused] = React.useState(false);
    const [displayValue, setDisplayValue] = React.useState<string>(
      value === undefined || value === null ? "" : String(value)
    );

    React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

    React.useEffect(() => {
      if (!allowEmpty || !isFocused) {
        setDisplayValue(value === undefined || value === null ? "" : String(value));
      }
    }, [allowEmpty, isFocused, value]);

    const step = (direction: "up" | "down") => {
      const input = inputRef.current;
      if (!input || isDisabled) return;
      // stepUp and stepDown keep within min, max and step (an empty box steps from 0)
      if (direction === "up") input.stepUp();
      else input.stepDown();
      // React hears the new value as typing: its onChange runs with the input as the target
      input.dispatchEvent(new Event("input", { bubbles: true }));
    };

    const label = props["aria-label"];
    const button = (direction: "up" | "down") => (
      <button
        type="button"
        aria-label={`${direction === "up" ? "More" : "Less"}${label ? `: ${label}` : ""}`}
        onClick={() => step(direction)}
        disabled={isDisabled}
        tabIndex={stepButtonsTabIndex}
        className={cn(
          "flex shrink-0 items-center justify-center border border-strong bg-page text-accent-text transition-colors hover:bg-raised disabled:cursor-not-allowed disabled:opacity-60",
          // the field comes first in the page, so a label around it names the field, not a button
          (direction === "down") === !vertical ? "order-1" : "order-3",
          vertical
            ? cn("h-9 w-full min-[961px]:h-6", direction === "down" ? "border-t-0" : "border-b-0")
            : cn("w-9 min-[961px]:w-8", direction === "down" ? "border-r-0" : "border-l-0"),
          buttonClassName
        )}
      >
        {direction === "up" ? (
          <Plus aria-hidden="true" className="h-3.5 w-3.5" />
        ) : (
          <Minus aria-hidden="true" className="h-3.5 w-3.5" />
        )}
      </button>
    );

    return (
      <div
        className={cn(
          "flex items-stretch",
          vertical ? "w-10 flex-col" : HEIGHT[inputSize],
          !vertical && (compact ? "w-fit shrink-0" : "w-full"),
          containerClassName
        )}
      >
        <Input
          ref={inputRef}
          type="number"
          inputSize={inputSize}
          disabled={disabled}
          readOnly={readOnly}
          value={allowEmpty ? displayValue : value}
          onChange={(event) => {
            if (allowEmpty) setDisplayValue(event.target.value);
            onChange?.(event);
          }}
          onFocus={(event) => {
            setIsFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setIsFocused(false);
            onBlur?.(event);
          }}
          className={cn(
            "order-2 min-h-0 appearance-none !px-1 text-center font-mono tabular-nums [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
            vertical ? "h-8 w-full md:h-8" : "h-full md:h-full",
            !vertical && (compact ? "w-14" : "min-w-0 flex-1"),
            className
          )}
          {...props}
        />
        {button("down")}
        {button("up")}
      </div>
    );
  }
);

NumberInput.displayName = "NumberInput";

export { NumberInput };
