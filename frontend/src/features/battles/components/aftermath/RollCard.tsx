import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import DiceEntry from "@/components/ui/dice-entry";
import type { Dice } from "@/lib/dice";
import { cn } from "@/lib/utils";

type Rolled = { faces: number[]; result: string; good: boolean; onUndo: () => void };

/** Dice faces as square boxes (the Aftermath's rolls). */
export function DiceFaces({ faces, size = "md" }: { faces: number[]; size?: "md" | "lg" }) {
  return (
    <span className="flex gap-2">
      {faces.map((face, index) => (
        <span
          key={index}
          className={cn(
            "flex items-center justify-center border border-strong font-mono font-bold text-head",
            size === "lg" ? "h-14 w-14 text-2xl" : "h-10 w-10 text-lg"
          )}
        >
          {face}
        </span>
      ))}
    </span>
  );
}

/**
 * One roll on the Injuries tab (design E): the unit and its dice, then Roll with a box for each
 * die rolled at the table, or the faces, the result in good or danger, and Undo. A bad result
 * lines the card in danger.
 */
export default function RollCard({
  title,
  subtitle,
  danger,
  isMobile,
  rolled,
  dice,
  onFaces,
  children,
}: {
  title: string;
  subtitle: string;
  danger: boolean;
  isMobile: boolean;
  rolled: Rolled | null;
  /** What it rolls: "Roll D66" and two boxes, tens then units. */
  dice: Dice;
  /** The faces, rolled or typed: the same draft either way. */
  onFaces: (faces: number[]) => void;
  children?: ReactNode;
}) {
  return (
    <article
      className={cn(
        "flex bg-surface",
        isMobile ? "flex-col gap-2.5 p-3" : "flex-wrap items-center gap-x-6 gap-y-3 px-[18px] py-4",
        danger ? "border border-danger-line" : "border border-border"
      )}
    >
      <div
        className={cn(
          "flex gap-0.5",
          isMobile ? "items-baseline justify-between gap-2" : "min-w-[220px] flex-1 flex-col"
        )}
      >
        <h2
          className={cn(
            "m-0 font-display font-semibold text-head",
            isMobile ? "text-base" : "text-[19px]"
          )}
        >
          {title}
        </h2>
        <span className="text-[13px] text-muted-foreground">{subtitle}</span>
      </div>
      {rolled ? (
        <div className="flex items-center gap-2.5">
          <DiceFaces faces={rolled.faces} />
          <span
            className={cn(
              "text-[15px] font-bold",
              isMobile ? "flex-1" : "min-w-[150px]",
              rolled.good ? "text-good" : "text-danger"
            )}
          >
            {rolled.result}
          </span>
          <Button
            size="sm"
            variant="secondary"
            className="h-9 text-xs text-muted-foreground"
            onClick={rolled.onUndo}
          >
            Undo
          </Button>
        </div>
      ) : (
        <DiceEntry
          dice={dice}
          size={isMobile ? "lg" : "md"}
          className={isMobile ? "flex-nowrap" : undefined}
          onFaces={onFaces}
          button={(roll) => (
            <Button className={isMobile ? "min-h-12 flex-1 text-[15px]" : ""} onClick={roll}>
              Roll {dice}
            </Button>
          )}
        />
      )}
      {children}
    </article>
  );
}
