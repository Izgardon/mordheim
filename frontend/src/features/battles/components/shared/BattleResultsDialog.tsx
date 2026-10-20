import { useEffect, useState, type DragEvent } from "react";
import { ArrowLeftRight, GripVertical } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HELPER_DIALOG_CONTENT_CLASS } from "@/features/battles/components/shared/battle-dialog-styles";
import { cn } from "@/lib/utils";

/** A warband still in the battle, as the results modal shows it. */
export type ResultsWarband = {
  warbandId: number;
  warbandName: string;
  playerLabel: string;
  /** What its player said when he finished his fight (decision 4). */
  declared?: "won" | "lost" | "undecided" | null;
};

type Side = "winners" | "losers";

const DRAG_TYPE = "application/x-mordheim-warband";

function ResultsCard({
  warband,
  side,
  onMove,
}: {
  warband: ResultsWarband;
  side: Side;
  onMove: (warbandId: number, to: Side) => void;
}) {
  const other: Side = side === "winners" ? "losers" : "winners";
  return (
    <li
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(DRAG_TYPE, String(warband.warbandId));
        event.dataTransfer.effectAllowed = "move";
      }}
      className="battle-inline-panel flex min-h-11 cursor-grab items-center gap-2 rounded-lg py-1 pl-2 text-sm active:cursor-grabbing"
    >
      <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-foreground">{warband.warbandName}</p>
        <p className="truncate text-xs text-muted-foreground">
          {warband.playerLabel}
          {warband.declared ? ` · said ${warband.declared}` : ""}
        </p>
      </div>
      <button
        type="button"
        className="icon-button flex h-11 shrink-0 items-center gap-1 px-2 text-xs text-muted-foreground transition hover:text-foreground"
        onClick={() => onMove(warband.warbandId, other)}
        aria-label={`Move ${warband.warbandName} to ${other === "winners" ? "Winners" : "Losers"}`}
      >
        <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </li>
  );
}

function ResultsColumn({
  side,
  warbands,
  onMove,
  note,
}: {
  side: Side;
  warbands: ResultsWarband[];
  onMove: (warbandId: number, to: Side) => void;
  note?: string;
}) {
  const [isOver, setIsOver] = useState(false);
  const title = side === "winners" ? "Winners" : "Losers";
  const accept = (event: DragEvent) => {
    if (event.dataTransfer.types.includes(DRAG_TYPE)) {
      event.preventDefault();
      setIsOver(true);
    }
  };
  return (
    <section
      aria-label={title}
      onDragOver={accept}
      onDragEnter={accept}
      onDragLeave={() => setIsOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsOver(false);
        const warbandId = Number(event.dataTransfer.getData(DRAG_TYPE));
        if (Number.isFinite(warbandId) && warbandId > 0) onMove(warbandId, side);
      }}
      className={cn(
        "min-h-28 space-y-2 rounded-xl border border-dashed border-border/60 p-2 transition",
        isOver && "border-amber-300/70 bg-amber-900/10"
      )}
    >
      <p className="battle-section-title">{title}</p>
      <ul className="space-y-2">
        {warbands.map((warband) => (
          <ResultsCard key={warband.warbandId} warband={warband} side={side} onMove={onMove} />
        ))}
      </ul>
      {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
    </section>
  );
}

/**
 * Confirm results (decision 4): every warband still in is a card in Winners or Losers. Drag a card
 * across, or use its move button (keyboard and touch). An empty Winners column is No winner.
 * The last player to finish sees it; a battle manager uses it to end a stuck battle too.
 */
export default function BattleResultsDialog({
  open,
  onOpenChange,
  title = "Confirm results",
  description,
  warbands,
  initialWinners,
  confirmLabel = "Confirm results",
  isSubmitting,
  error,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description: string;
  warbands: ResultsWarband[];
  /** Where the cards start: these in Winners, the rest in Losers. */
  initialWinners: number[];
  confirmLabel?: string;
  isSubmitting: boolean;
  error: string;
  onSubmit: (results: { winners: number[]; losers: number[] }) => void;
}) {
  const [winners, setWinners] = useState<number[]>(initialWinners);
  const initialKey = initialWinners.join(",");
  useEffect(() => {
    if (open) setWinners(initialKey ? initialKey.split(",").map(Number) : []);
  }, [initialKey, open]);

  const move = (warbandId: number, to: Side) =>
    setWinners((current) =>
      to === "winners"
        ? current.includes(warbandId)
          ? current
          : [...current, warbandId]
        : current.filter((entry) => entry !== warbandId)
    );
  const winning = warbands.filter((warband) => winners.includes(warband.warbandId));
  const losing = warbands.filter((warband) => !winners.includes(warband.warbandId));
  const noWinner = winning.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`max-w-2xl ${HELPER_DIALOG_CONTENT_CLASS}`}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="block text-sm text-muted-foreground">
            {description}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <ResultsColumn
            side="winners"
            warbands={winning}
            onMove={move}
            note={noWinner ? "No winner: no wins or losses are recorded." : undefined}
          />
          <ResultsColumn side="losers" warbands={losing} onMove={move} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-11"
            disabled={noWinner}
            onClick={() => setWinners([])}
          >
            No winner
          </Button>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Not now
          </Button>
          <Button
            type="button"
            disabled={isSubmitting}
            onClick={() =>
              onSubmit({
                winners: winning.map((warband) => warband.warbandId),
                // "No winner": nobody lost either.
                losers: noWinner ? [] : losing.map((warband) => warband.warbandId),
              })
            }
          >
            {isSubmitting ? "Saving..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
