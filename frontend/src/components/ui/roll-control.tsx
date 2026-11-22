import { useState } from "react";
import { Dices, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import DiceEntry, { boxName } from "@/components/ui/dice-entry";
import { diceSides, rollDie, type Dice } from "@/lib/dice";
import { cn } from "@/lib/utils";

type RollControlProps = {
  /** The roll: "D6" for a location. */
  dice: Dice;
  /** The button before the roll (default "Roll <dice>"). */
  label?: string;
  /** The button once the roll is taken, locked: "Rolled". */
  lockedLabel: string;
  /** The faces taken, rolled or typed: the caller keeps them, and while it does the button is locked. */
  faces: number[] | null;
  /** The faces, rolled with the button or typed in the boxes. */
  onResult: (faces: number[]) => void;
  disabled?: boolean;
  /** "lg" for a phone: a taller button and boxes; "sm" for one of a card's actions. */
  size?: keyof typeof BOX;
  /** An outlined button, for a roll that isn't the main action where it sits (a location's). */
  quiet?: boolean;
  className?: string;
};

const FACE =
  "box-border inline-flex items-center justify-center border border-strong bg-page font-mono font-bold text-head";
/** The boxes at each size, as DiceEntry draws them. */
const BOX = { sm: "h-9 w-9 text-base", default: "h-10 w-10 text-lg", lg: "h-12 w-12 text-xl" };
const ENTRY = { sm: "sm", default: "md", lg: "lg" } as const;

/**
 * A roll the app makes or the table made, taken once: the boxes above the button take the dice
 * rolled at the table (the shared `DiceEntry`), the button rolls them here, and either way the
 * faces go to `onResult`. Once the caller holds them the button is locked under `lockedLabel` and
 * the boxes show the roll.
 */
export default function RollControl({
  dice,
  label,
  lockedLabel,
  faces,
  onResult,
  disabled = false,
  size = "default",
  quiet = false,
  className,
}: RollControlProps) {
  const sides = diceSides(dice);
  /** Some boxes hold a face and some don't: the button waits for the rest. */
  const [halfTyped, setHalfTyped] = useState(false);
  const locked = faces !== null;

  return (
    <div className={cn("flex flex-col items-start gap-2", className)}>
      {faces ? (
        <span className="flex gap-1.5">
          {faces.map((face, index) => (
            <input
              key={index}
              readOnly
              aria-label={boxName(sides, index)}
              value={face}
              className={cn(FACE, "p-0 text-center", BOX[size])}
            />
          ))}
        </span>
      ) : (
        <DiceEntry
          dice={dice}
          button={null}
          size={ENTRY[size]}
          disabled={disabled}
          onChange={(next) =>
            setHalfTyped(next.some((face) => face !== null) && next.some((face) => face === null))
          }
          onFaces={(next) => {
            setHalfTyped(false);
            onResult(next);
          }}
        />
      )}
      <Button
        size={size}
        variant={locked || quiet ? "secondary" : "primary"}
        disabled={locked || disabled || halfTyped}
        onClick={() => onResult(sides.map((die) => rollDie(die)))}
        className={cn(
          locked && "disabled:opacity-100 border-border bg-raised text-muted-foreground"
        )}
      >
        {locked ? <Lock aria-hidden="true" /> : <Dices aria-hidden="true" />}
        {locked ? lockedLabel : (label ?? `Roll ${dice}`)}
      </Button>
    </div>
  );
}
