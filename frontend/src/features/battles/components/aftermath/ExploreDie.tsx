import { Dices } from "lucide-react";

import { IconButton } from "@/components/ui/icon-button";
import { rollDie } from "@/lib/dice";
import { cn } from "@/lib/utils";

/** The face a keystroke leaves in the box: the last digit a D6 shows, else what was there. */
export const faceTyped = (text: string, before: number) => {
  const digit = [...text].reverse().find((character) => character >= "1" && character <= "6");
  return digit ? Number(digit) : before;
};

/**
 * One die of the exploration roll, after it has been thrown (William's unanswered bullet:
 * "exploration dice editable and individually re-rollable"): the face is typed over in its box or
 * thrown again on its own, and the other dice stay as they were. A multiple the chart found is
 * marked, and a die the chart doesn't count reads faint. Changing a die after the step has been
 * applied is allowed and warned about by the server; what was handed over stays as it is.
 */
export default function ExploreDie({
  value,
  index,
  found,
  chosen,
  isMobile,
  onFace,
}: {
  value: number;
  index: number;
  /** Part of a multiple the campaign's chart gives a place for. */
  found: boolean;
  /** Counted towards the shards (the chart takes only so many dice). */
  chosen: boolean;
  isMobile: boolean;
  onFace: (face: number) => void;
}) {
  const name = `Die ${index + 1}`;
  return (
    <div className="flex flex-col items-center gap-1">
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        enterKeyHint="done"
        aria-label={name}
        value={String(value)}
        onFocus={(event) => event.target.select()}
        onChange={(event) => onFace(faceTyped(event.target.value, value))}
        className={cn(
          "box-border bg-page p-0 text-center font-mono font-bold",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
          isMobile ? "h-[52px] w-[52px] text-[22px]" : "h-14 w-14 text-2xl",
          found && chosen
            ? "border-2 border-primary text-accent-hi"
            : "border border-strong text-head",
          !chosen && "opacity-40"
        )}
      />
      <IconButton
        aria-label={`Roll ${name.toLowerCase()} again`}
        className={isMobile ? "h-9 w-[52px]" : "h-8 w-14"}
        onClick={() => onFace(rollDie(6))}
      >
        <Dices aria-hidden="true" />
      </IconButton>
    </div>
  );
}
