import { useState } from "react";
import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import DiceEntry from "@/components/ui/dice-entry";
import { IconButton } from "@/components/ui/icon-button";
import { ModalSheet } from "@/components/ui/modal-sheet";
import type { Dice } from "@/lib/dice";
import { cn } from "@/lib/utils";

/** The die types (William, 12 Nov 2026: "keep D3 as a type, there's no harm"). */
const KINDS = ["D3", "D6", "D66"] as const;
type Kind = (typeof KINDS)[number];

const MOST = 10;
/** A D66 is one roll read as tens and units, so it is never thrown more than once here. */
const countsOf = (kind: Kind) => kind !== "D66";

/** The roll as the rules write it: "D6", "3D6", "D66". */
export const diceNotation = (kind: Kind, count: number): Dice =>
  (countsOf(kind) && count > 1 ? `${count}${kind}` : kind) as Dice;

/** What the dice come to: a D66's two faces are tens and units, the rest add up. */
export function diceTotal(kind: Kind, faces: number[]) {
  if (kind === "D66" && faces.length === 2) return faces[0] * 10 + faces[1];
  return faces.reduce((sum, face) => sum + face, 0);
}

/**
 * The battle dice (design E): the die picked, how many of it are thrown (William, 12 Nov 2026:
 * "multiple dice selectable, so 2D6 stops being its own option"), then rolled here or typed into
 * the box beside each die. Battle dice record nothing.
 */
export default function BattleDiceSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [kind, setKind] = useState<Kind>("D6");
  const [count, setCount] = useState(2);
  const [faces, setFaces] = useState<number[]>([]);
  const dice = diceNotation(kind, count);
  const step = (to: number) => {
    setCount(Math.max(1, Math.min(MOST, to)));
    setFaces([]);
  };
  return (
    <ModalSheet
      open={open}
      onOpenChange={onOpenChange}
      kicker="Battle dice"
      title="Roll"
      className="max-w-[440px]"
      footer={
        <Button variant="secondary" className="min-h-12 w-full" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      }
    >
      <div role="group" aria-label="Die" className="grid grid-cols-3 gap-1.5">
        {KINDS.map((entry) => (
          <button
            key={entry}
            type="button"
            aria-pressed={kind === entry}
            onClick={() => {
              setKind(entry);
              setFaces([]);
            }}
            className={cn(
              "min-h-12 border font-mono text-[15px] font-bold",
              kind === entry
                ? "border-accent-line bg-accent-soft text-accent-hi"
                : "border-border bg-transparent text-text2"
            )}
          >
            {entry}
          </button>
        ))}
      </div>
      {countsOf(kind) ? (
        <div role="group" aria-label="Dice" className="flex items-center gap-2">
          <IconButton
            aria-label="Lower dice"
            className="h-11 w-11"
            disabled={count <= 1}
            onClick={() => step(count - 1)}
          >
            <Minus aria-hidden="true" />
          </IconButton>
          <span className="min-w-[88px] text-center font-mono text-[15px] font-bold text-head">
            {count} {count === 1 ? "die" : "dice"}
          </span>
          <IconButton
            aria-label="Raise dice"
            className="h-11 w-11"
            disabled={count >= MOST}
            onClick={() => step(count + 1)}
          >
            <Plus aria-hidden="true" />
          </IconButton>
        </div>
      ) : null}
      <DiceEntry
        // a different roll starts with empty boxes
        key={dice}
        dice={dice}
        size="lg"
        onFaces={setFaces}
        onChange={(entered) =>
          setFaces(entered.every((face) => face !== null) ? (entered as number[]) : [])
        }
        button={(roll) => (
          <Button className="min-h-12 w-full text-[15px]" onClick={roll}>
            Roll {dice}
          </Button>
        )}
        className="gap-2.5"
      />
      <div
        aria-live="polite"
        className="flex min-h-[64px] items-center justify-between gap-2.5 border border-accent-line bg-surface p-3"
      >
        {faces.length === 0 ? (
          <span className="text-sm text-muted-foreground">Nothing rolled yet.</span>
        ) : (
          <>
            <span className="text-sm text-text2">Total</span>
            <span className="font-display text-[30px] font-semibold text-accent-hi">
              {diceTotal(kind, faces)}
            </span>
          </>
        )}
      </div>
    </ModalSheet>
  );
}
