import { ModalSheet } from "@/components/ui/modal-sheet";

import type { RatingRow } from "../../types/warband-types";
import { ratingSections, unitLevelLine } from "./header-windows";
import WindowSection from "./WindowSection";

type UnitsWindowProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warbandName: string;
  rows: RatingRow[];
};

/** Every unit on the roster by its kind, each with its type and level (the server's). */
export default function UnitsWindow({ open, onOpenChange, warbandName, rows }: UnitsWindowProps) {
  const sections = ratingSections(rows);
  return (
    <ModalSheet
      open={open}
      onOpenChange={onOpenChange}
      kicker={warbandName}
      title="Units"
      closeButton
    >
      {sections.length === 0 ? (
        <p className="m-0 text-sm text-muted-foreground">No units yet.</p>
      ) : null}
      {sections.map((section) => (
        <WindowSection key={section.kind} label={section.label}>
          {section.rows.map((row) => (
            <li
              key={`${row.kind}-${row.id}`}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 border-t border-line py-2"
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-semibold text-ink">{row.name}</span>
                {row.unit_type && row.unit_type !== row.name ? (
                  <span className="truncate text-xs text-muted-foreground">{row.unit_type}</span>
                ) : null}
              </span>
              <span className="text-xs font-bold text-text2">{unitLevelLine(row)}</span>
            </li>
          ))}
        </WindowSection>
      ))}
    </ModalSheet>
  );
}
