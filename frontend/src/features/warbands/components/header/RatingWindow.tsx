import { ModalSheet } from "@/components/ui/modal-sheet";

import type { RatingRow } from "../../types/warband-types";
import { ratingSections, ratingSum } from "./header-windows";
import WindowSection from "./WindowSection";

type RatingWindowProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warbandName: string;
  rating: number;
  rows: RatingRow[];
};

/** The rating unit by unit (the server's breakdown), adding up to its total. */
export default function RatingWindow({
  open,
  onOpenChange,
  warbandName,
  rating,
  rows,
}: RatingWindowProps) {
  return (
    <ModalSheet
      open={open}
      onOpenChange={onOpenChange}
      kicker={warbandName}
      title="Warband rating"
      closeButton
    >
      {ratingSections(rows).map((section) => (
        <WindowSection key={section.kind} label={section.label}>
          {section.rows.map((row) => (
            <li
              key={`${row.kind}-${row.id}`}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 border-t border-line py-2"
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-semibold text-ink">{row.name}</span>
                <span className="text-xs text-muted-foreground">
                  {row.missing ? "Missing games: not counted" : ratingSum(row)}
                </span>
              </span>
              <span className="font-mono text-sm font-bold text-head">
                {row.missing ? "–" : row.total}
              </span>
            </li>
          ))}
        </WindowSection>
      ))}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 border-t-2 border-strong pt-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-faint">Total</span>
        <span className="font-mono text-base font-bold text-head">{rating}</span>
      </div>
    </ModalSheet>
  );
}
