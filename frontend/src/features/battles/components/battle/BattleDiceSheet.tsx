import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ModalSheet } from "@/components/ui/modal-sheet";
import { rollDice, rollDie } from "@/lib/dice";
import { cn } from "@/lib/utils";

const KINDS = ["D3", "D6", "2D6", "D66"] as const;
type Kind = (typeof KINDS)[number];

function roll(kind: Kind) {
  if (kind === "D3") return [rollDie(3)];
  if (kind === "D6") return [rollDie(6)];
  return rollDice(2);
}

function total(kind: Kind, faces: number[]) {
  if (kind === "D66" && faces.length === 2) return faces[0] * 10 + faces[1];
  return faces.reduce((sum, face) => sum + face, 0);
}

/** The battle dice (design E): D3, D6, 2D6 or D66, rolled here. Battle dice record nothing. */
export default function BattleDiceSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [kind, setKind] = useState<Kind>("2D6");
  const [faces, setFaces] = useState<number[]>([]);
  return (
    <ModalSheet
      open={open}
      onOpenChange={onOpenChange}
      kicker="Battle dice"
      title="Roll"
      className="max-w-[440px]"
      footer={
        <div className="grid grid-cols-[1fr_2fr] gap-2">
          <Button variant="secondary" className="min-h-12" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button className="min-h-12 text-[15px]" onClick={() => setFaces(roll(kind))}>
            Roll {kind}
          </Button>
        </div>
      }
    >
      <div role="group" aria-label="Dice" className="grid grid-cols-4 gap-1.5">
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
      <div
        aria-live="polite"
        className="flex min-h-[78px] items-center gap-2.5 border border-accent-line bg-surface p-3"
      >
        {faces.length === 0 ? (
          <span className="text-sm text-muted-foreground">Nothing rolled yet.</span>
        ) : (
          <>
            {faces.map((face, index) => (
              <span
                key={index}
                className="flex h-[52px] w-[52px] items-center justify-center border border-strong font-mono text-2xl font-bold text-head"
              >
                {face}
              </span>
            ))}
            <span className="ml-auto font-display text-[30px] font-semibold text-accent-hi">
              {total(kind, faces)}
            </span>
          </>
        )}
      </div>
    </ModalSheet>
  );
}
