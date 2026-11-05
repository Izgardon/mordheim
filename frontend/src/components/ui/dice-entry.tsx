import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { diceSides, rollDie, type Dice } from "@/lib/dice";
import { cn } from "@/lib/utils";

const ORDINALS = [
  "First",
  "Second",
  "Third",
  "Fourth",
  "Fifth",
  "Sixth",
  "Seventh",
  "Eighth",
  "Ninth",
  "Tenth",
  "Eleventh",
  "Twelfth",
];

/** A box's name: "D100 rolled" when the roll is one die, else "First D6 rolled", "Second D6 rolled". */
export function boxName(sides: number[], index: number) {
  const die = `D${sides[index]}`;
  if (sides.length === 1) return `${die} rolled`;
  return `${ORDINALS[index] ?? `${index + 1}th`} ${die} rolled`;
}

const fits = (text: string, sides: number) =>
  text === "" || (/^[1-9]\d*$/.test(text) && Number(text) <= sides);

/** A box no further digit fits: "4" on a D6, "42" on a D100 (a D100's "4" may still be "42"). */
const full = (text: string, sides: number) => text !== "" && Number(`${text}0`) > sides;

/**
 * What a box holds once `typed` is in it (it held `before`): only a number its die shows. A digit
 * typed into a full box starts it again when that digit fits; anything else leaves it as it was.
 */
export function boxText(typed: string, sides: number, before: string) {
  const digits = typed.replace(/\D/g, "");
  if (fits(digits, sides)) return digits;
  if (!full(before, sides)) return before;
  const added = [...digits].find((digit, index) => digit !== before[index]) ?? "";
  return fits(added, sides) ? added : before;
}

const facesOf = (texts: string[]) => texts.map((text) => (text === "" ? null : Number(text)));

type Entry = {
  texts: string[];
  /** The faces as they stand went to `onFaces` (rolled, typed, or the caller's own total). */
  given: boolean;
  /** The caller's total and the dice the boxes were last set for. */
  total: number | null | undefined;
  count: number;
};

/**
 * The boxes for the caller's total: kept while they agree with it (it came from them), else a
 * single die's total as its face, else empty (two dice can't be told from their total).
 */
function entryFor(entry: Entry | null, sides: number[], total: number | null | undefined): Entry {
  const texts = sides.map((_, index) => entry?.texts[index] ?? "");
  const faces = facesOf(texts);
  const complete = faces.every((face) => face !== null);
  const sum = faces.reduce<number>((acc, face) => acc + (face ?? 0), 0);
  const agrees = total === undefined || (complete ? sum === total : total === null);
  if (entry && agrees) return { texts, given: entry.given && complete, total, count: sides.length };
  const own = sides.length === 1 && total != null;
  return {
    texts: own ? [String(total)] : sides.map(() => ""),
    given: own,
    total,
    count: sides.length,
  };
}

const BOX = { sm: "h-9 w-9 text-base", md: "h-10 w-10 text-lg", lg: "h-12 w-12 text-xl" } as const;
/** A D100's box, wide enough for 100. */
const WIDE = { sm: "w-12", md: "w-14", lg: "w-16" } as const;

type DiceEntryProps = {
  dice: Dice;
  /**
   * The faces, rolled with the button or typed: typed, once every box holds one and the last box
   * takes no more digits (a D100's "4" waits for Enter or for the box to be left).
   */
  onFaces: (faces: number[]) => void;
  /** Every change to the boxes, an empty box null. */
  onChange?: (faces: (number | null)[]) => void;
  /**
   * The total the caller keeps from the faces (a price, a stat, a location's result), for boxes
   * that stay beside it: a total of the caller's own sets them (a single die shows it, more dice
   * empty), and null empties them. Leave it out for boxes that start empty and keep what was entered.
   */
  total?: number | null;
  /** The Roll button, drawn around `roll` (default: a secondary "Roll 2D6"); null for the boxes alone. */
  button?: ((roll: () => void) => ReactNode) | null;
  disabled?: boolean;
  size?: keyof typeof BOX;
  className?: string;
};

/**
 * A roll the app makes or the table made (William, 5 Nov: "a guide but promote in person
 * rolling"): the Roll button with a box beside it for each die's face (2D6 and a D66, tens then
 * units, two boxes; a D100 one). Rolled or typed, the faces go to the same `onFaces`, so a typed
 * roll is the roll. A box takes only its die's numbers and moves on to the next when full.
 */
export default function DiceEntry({
  dice,
  onFaces,
  onChange,
  total,
  button,
  disabled = false,
  size = "md",
  className,
}: DiceEntryProps) {
  const sides = diceSides(dice);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const [state, setState] = useState(() => entryFor(null, sides, total));
  let entry = state;
  if (state.total !== total || state.count !== sides.length) {
    entry = entryFor(state, sides, total);
    setState(entry);
  }

  const roll = () => {
    const faces = sides.map((die) => rollDie(die));
    setState({ ...entry, texts: faces.map(String), given: true });
    onChange?.(faces);
    onFaces(faces);
  };

  const type = (index: number, typed: string) => {
    const text = boxText(typed, sides[index], entry.texts[index]);
    if (text === entry.texts[index]) return;
    const texts = entry.texts.map((before, i) => (i === index ? text : before));
    const faces = facesOf(texts);
    const settled = full(text, sides[index]) && faces.every((face) => face !== null);
    setState({ ...entry, texts, given: settled });
    onChange?.(faces);
    if (settled) onFaces(faces as number[]);
    if (full(text, sides[index])) boxes.current[index + 1]?.focus();
  };

  /** Enter, or leaving a box: faces that are all in and not yet given go. */
  const settle = () => {
    const faces = facesOf(entry.texts);
    if (entry.given || faces.some((face) => face === null)) return;
    setState({ ...entry, given: true });
    onFaces(faces as number[]);
  };

  const key = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") settle();
    if (event.key === "Backspace" && entry.texts[index] === "" && index > 0) {
      event.preventDefault();
      boxes.current[index - 1]?.focus();
    }
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {button === undefined ? (
        <Button
          variant="secondary"
          size={size === "sm" ? "sm" : "default"}
          className={size === "sm" ? "h-9" : size === "lg" ? "h-12" : undefined}
          disabled={disabled}
          onClick={roll}
        >
          Roll {dice}
        </Button>
      ) : (
        button?.(roll)
      )}
      {sides.length ? (
        <span className="flex flex-wrap gap-1.5">
          {sides.map((die, index) => (
            <input
              key={index}
              ref={(node) => {
                boxes.current[index] = node;
              }}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              enterKeyHint="done"
              aria-label={boxName(sides, index)}
              value={entry.texts[index]}
              disabled={disabled}
              onFocus={(event) => event.target.select()}
              onChange={(event) => type(index, event.target.value)}
              onKeyDown={(event) => key(index, event)}
              onBlur={settle}
              className={cn(
                "box-border border border-strong bg-page p-0 text-center font-mono font-bold text-head",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                "disabled:cursor-not-allowed disabled:opacity-50",
                BOX[size],
                die > 9 && WIDE[size]
              )}
            />
          ))}
        </span>
      ) : null}
    </div>
  );
}
