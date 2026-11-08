import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { Dices, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import DiceEntry, { boxName } from "@/components/ui/dice-entry";
import { diceSides, rollDie, type Dice } from "@/lib/dice";
import { cn } from "@/lib/utils";

type RollControlProps = {
  /** The roll: "2D6" for a rare item's search, "D6" for a location. */
  dice: Dice;
  /** The button before the roll (default "Roll <dice>"): "Roll to search". */
  label?: string;
  /** The button once the roll is taken, locked: "Searched", "Rolled". */
  lockedLabel: string;
  /** Added to the dice in the result line: "4 2 +1 = 7". */
  bonus?: number;
  /**
   * The dice rolled at the table: boxes behind an "or enter your dice" link under the button, with
   * the result line once taken (the store); boxes above the button that then show the roll, with
   * no result line (a location); or none.
   */
  entry?: "link" | "above" | "none";
  /** The faces taken, rolled or typed: the caller keeps them, and while it does the button is locked. */
  faces: number[] | null;
  /** The faces, rolled with the button or typed in the boxes. */
  onResult: (faces: number[]) => void;
  /** After the result line's total: "Found", "Not found". */
  verdict?: ReactNode;
  disabled?: boolean;
  /** "lg" for a phone: a taller button and boxes. */
  size?: "default" | "lg";
  className?: string;
};

const FACE =
  "box-border inline-flex items-center justify-center border border-strong bg-page font-mono font-bold text-head";

/**
 * A roll the app makes or the table made, taken once (William, 7 Nov 2026: "roll button to search
 * to be prominent and blocked once searched"): the button rolls the dice here, the boxes take the
 * dice rolled at the table (the shared `DiceEntry`), and either way the faces go to `onResult`.
 * Once the caller holds them the button is locked under `lockedLabel` and the faces show: in a
 * result line with the bonus and the caller's verdict, or in the boxes above the button.
 */
export default function RollControl({
  dice,
  label,
  lockedLabel,
  bonus = 0,
  entry = "link",
  faces,
  onResult,
  verdict,
  disabled = false,
  size = "default",
  className,
}: RollControlProps) {
  const sides = diceSides(dice);
  const [revealed, setRevealed] = useState(false);
  /** Some boxes hold a face and some don't: the button waits for the rest. */
  const [halfTyped, setHalfTyped] = useState(false);
  const boxes = useRef<HTMLDivElement>(null);
  const locked = faces !== null;
  const above = entry === "above";
  const typing = !locked && (above || (entry === "link" && revealed));

  useEffect(() => {
    if (revealed) boxes.current?.querySelector("input")?.focus();
  }, [revealed]);

  const total = (faces ?? []).reduce((sum, face) => sum + face, 0) + bonus;
  const box = size === "lg" ? "h-12 w-12 text-xl" : "h-10 w-10 text-lg";
  const typed = typing ? (
    <div ref={boxes}>
      <DiceEntry
        dice={dice}
        button={null}
        size={size === "lg" ? "lg" : "md"}
        disabled={disabled}
        onChange={(next) =>
          setHalfTyped(next.some((face) => face !== null) && next.some((face) => face === null))
        }
        onFaces={(next) => {
          setHalfTyped(false);
          onResult(next);
        }}
      />
    </div>
  ) : null;
  const shown =
    above && faces ? (
      <span className="flex gap-1.5">
        {faces.map((face, index) => (
          <input
            key={index}
            readOnly
            aria-label={boxName(sides, index)}
            value={face}
            className={cn(FACE, "p-0 text-center", box)}
          />
        ))}
      </span>
    ) : null;

  return (
    <div className={cn("flex flex-col items-start gap-2", className)}>
      {above ? (typed ?? shown) : null}
      <Button
        size={size === "lg" ? "lg" : "default"}
        variant={locked ? "secondary" : "primary"}
        disabled={locked || disabled || (typing && halfTyped)}
        onClick={() => onResult(sides.map((die) => rollDie(die)))}
        className={cn(
          locked && "disabled:opacity-100 border-border bg-raised text-muted-foreground"
        )}
      >
        {locked ? <Lock aria-hidden="true" /> : <Dices aria-hidden="true" />}
        {locked ? lockedLabel : (label ?? `Roll ${dice}`)}
      </Button>
      {entry === "link" && !locked ? (
        revealed ? (
          typed
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => setRevealed(true)}
            className="w-fit text-xs font-semibold text-accent-text underline-offset-2 hover:underline disabled:opacity-50"
          >
            or enter your dice
          </button>
        )
      ) : null}
      {faces && !above ? (
        <p role="status" className="m-0 flex flex-wrap items-center gap-1.5 text-sm text-ink">
          {faces.map((face, index) => (
            <Fragment key={index}>
              {index ? " " : null}
              <span className={cn(FACE, "h-7 w-7 text-sm")}>{face}</span>
            </Fragment>
          ))}{" "}
          {bonus ? (
            <span className="font-mono font-bold text-text2">
              {bonus > 0 ? `+${bonus}` : bonus}
            </span>
          ) : null}{" "}
          <span className="font-mono font-bold text-head">= {total}</span> {verdict}
        </p>
      ) : null}
    </div>
  );
}
