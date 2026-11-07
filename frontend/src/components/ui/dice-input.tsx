import * as React from "react";

import { cn } from "@/lib/utils";

type DiceInputProps = {
  /** The count box's id, for a label's `htmlFor`. */
  id?: string;
  /** How many dice ("2" for 2D6); blank for none. */
  count: string;
  /** What each pip is worth ("25" for D6 × 25); blank for 1. */
  multiplier: string;
  onCountChange: (count: string) => void;
  onMultiplierChange: (multiplier: string) => void;
  /** The dice the count is of: every price in the books rolls D6s. */
  die?: string;
  /** The unit's name for a screen reader ("Dice for price 1"). */
  label?: string;
  invalid?: boolean;
  className?: string;
};

const BOX =
  "h-full min-w-0 bg-transparent px-1 text-center font-mono text-sm font-medium text-ink outline-none placeholder:text-faint";
const TAG = "flex items-center px-1.5 font-mono text-xs font-bold text-text2";

/**
 * Dice added to a price, as one unit: the count and the die ("[2] D6"; William: "2 inputs that
 * can exist together and be styled as a unit"). The multiplier stays hidden behind a small ×
 * once there are dice ("I also like the multiplier being hidden unless needed as confusing"),
 * and shows already open when there is one ("D6 × 25"). A price row's dice use it, and a hire fee
 * or upkeep can.
 */
export function DiceInput({
  id,
  count,
  multiplier,
  onCountChange,
  onMultiplierChange,
  die = "D6",
  label = "Dice",
  invalid = false,
  className,
}: DiceInputProps) {
  const [opened, setOpened] = React.useState(false);
  const multiplierRef = React.useRef<HTMLInputElement>(null);
  const open = opened || multiplier.trim() !== "";
  const typed = (value: string) => value.replace(/[^\d]/g, "");
  React.useEffect(() => {
    if (opened) multiplierRef.current?.focus();
  }, [opened]);

  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "flex h-8 w-fit items-stretch border border-strong bg-page focus-within:ring-2 focus-within:ring-inset focus-within:ring-ring md:h-9",
        invalid && "border-danger",
        className
      )}
    >
      <input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        aria-label={`${label}: how many ${die}`}
        aria-invalid={invalid || undefined}
        className={cn(BOX, "w-9")}
        value={count}
        onChange={(event) => onCountChange(typed(event.target.value))}
      />
      <span aria-hidden="true" className={cn(TAG, "border-l border-line")}>
        {die}
      </span>
      {open ? (
        <>
          <span aria-hidden="true" className={cn(TAG, "pl-0 pr-0.5")}>
            ×
          </span>
          <input
            ref={multiplierRef}
            inputMode="numeric"
            autoComplete="off"
            aria-label={`${label}: each pip is worth`}
            placeholder="1"
            className={cn(BOX, "w-11 border-l border-line")}
            value={multiplier}
            onChange={(event) => onMultiplierChange(typed(event.target.value))}
          />
        </>
      ) : count ? (
        <button
          type="button"
          aria-label={`${label}: multiply each pip`}
          onClick={() => setOpened(true)}
          className="flex w-7 items-center justify-center border-l border-line font-mono text-xs font-bold text-faint hover:bg-raised hover:text-accent-text"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}
