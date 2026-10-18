import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import {
  badgeClass,
  formatRowDate,
  formatSignedAmount,
  formatTradeAction,
  rowAmount,
  rowTotal,
} from "./treasury-format";

import type { WarbandTrade, WarbandTradeChild } from "../../../types/warband-types";

type TreasuryRowProps = {
  row: WarbandTrade;
  /** Its place in the list: rows alternate their shade. */
  index: number;
  expanded: boolean;
  onToggle: (id: number) => void;
  /** For editors: Correct, and Edit for a row entered by hand. */
  actions?: ReactNode;
  /** In place of the description and notes while the row is edited. */
  editor?: ReactNode;
  /** The row this Adjustment corrects, as the ledger describes it. */
  corrects?: string;
};

/** "Corrects: Rope", who entered the row by hand, and its notes (decision 6). */
function RowDetails({
  notes,
  author,
  corrects,
}: {
  notes: string;
  author?: string;
  corrects?: string;
}) {
  const lines = [
    corrects ? `Corrects: ${corrects}` : "",
    notes,
    author ? `Entered by ${author}` : "",
  ];
  return (
    <>
      {lines.filter(Boolean).map((line) => (
        <p
          key={line}
          className="mt-1 whitespace-normal break-words pl-[3.75rem] text-xs leading-snug text-muted-foreground"
        >
          {line}
        </p>
      ))}
    </>
  );
}

/** One ledger row, signed as the server stores it; a group row unfolds its children. */
export default function TreasuryRow({
  row,
  index,
  expanded,
  onToggle,
  actions,
  editor,
  corrects,
}: TreasuryRowProps) {
  const hasChildren = row.children.length > 0;
  const signedTotal = rowTotal(row);

  return (
    <div
      className="border-b border-border/30 px-3 py-2.5 text-sm text-foreground transition-[filter] hover:brightness-110 last:border-b-0"
      style={{
        backgroundColor: index % 2 === 0 ? "rgba(16, 12, 9, 0.5)" : "rgba(22, 16, 12, 0.75)",
      }}
    >
      <div className="flex items-center gap-3">
        <span className="w-10 shrink-0 text-xs text-muted-foreground">
          {formatRowDate(row.created_at)}
        </span>
        <div className="w-px shrink-0 self-stretch bg-border/30" aria-hidden="true" />
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {hasChildren ? (
            <button
              type="button"
              onClick={() => onToggle(row.id)}
              className="shrink-0 text-left"
              aria-expanded={expanded}
            >
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform duration-200 ${
                  expanded ? "rotate-0" : "-rotate-90"
                }`}
              />
            </button>
          ) : null}
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            {/* A group is signed by its children's total, not by "Group" (BUG-38). */}
            <span className={`shrink-0 ${badgeClass(signedTotal < 0)}`}>
              {formatTradeAction(row.action)}
            </span>
            <span className="min-w-0 flex-1 whitespace-normal break-words leading-snug">
              {row.description}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatSignedAmount(signedTotal)}
            </span>
            {actions}
          </div>
        </div>
      </div>
      {editor ?? <RowDetails notes={row.notes} author={row.created_by?.name} corrects={corrects} />}
      {hasChildren && expanded ? (
        <div className="mt-2 space-y-0 border-t border-border/30 pt-2">
          {row.children.map((child, childIndex) => (
            <TreasuryChildRow key={child.id} child={child} isFirst={childIndex === 0} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TreasuryChildRow({ child, isFirst }: { child: WarbandTradeChild; isFirst: boolean }) {
  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 ${isFirst ? "" : "border-t border-border/20"}`}
    >
      <span className="w-10 shrink-0 text-xs text-muted-foreground">
        {formatRowDate(child.created_at)}
      </span>
      <div className="w-px shrink-0 self-stretch bg-border/20" aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <span className={`shrink-0 ${badgeClass(rowAmount(child) < 0)}`}>
          {formatTradeAction(child.action)}
        </span>
        <span className="min-w-0 flex-1 whitespace-normal break-words leading-snug">
          {child.description}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {formatSignedAmount(rowAmount(child))}
        </span>
      </div>
      {[child.notes, child.created_by ? `Entered by ${child.created_by.name}` : ""]
        .filter(Boolean)
        .map((line) => (
          <p
            key={line}
            className="w-full whitespace-normal break-words pl-[3.75rem] text-xs leading-snug text-muted-foreground"
          >
            {line}
          </p>
        ))}
    </div>
  );
}
