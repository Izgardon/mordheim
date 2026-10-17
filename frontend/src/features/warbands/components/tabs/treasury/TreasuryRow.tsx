import { ChevronDown } from "lucide-react";

import { formatTradeAction } from "../../../utils/warband-utils";
import {
  actionBadgeClass,
  badgeClass,
  formatRowDate,
  formatSignedAmount,
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
};

/** One ledger row; a group row (purchases, recruits) unfolds its children. */
export default function TreasuryRow({ row, index, expanded, onToggle }: TreasuryRowProps) {
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
            <span
              className={`shrink-0 ${hasChildren ? badgeClass(signedTotal < 0) : actionBadgeClass(row.action)}`}
            >
              {formatTradeAction(row.action)}
            </span>
            <span className="min-w-0 flex-1 whitespace-normal break-words leading-snug">
              {row.description}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatSignedAmount(signedTotal)}
            </span>
          </div>
        </div>
      </div>
      {row.notes ? (
        <p className="mt-1 whitespace-normal break-words pl-[3.75rem] text-xs leading-snug text-muted-foreground">
          {row.notes}
        </p>
      ) : null}
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
        <span className={`shrink-0 ${actionBadgeClass(child.action)}`}>
          {formatTradeAction(child.action)}
        </span>
        <span className="min-w-0 flex-1 whitespace-normal break-words leading-snug">
          {child.description}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {formatSignedAmount(rowAmount(child))}
        </span>
      </div>
      {child.notes ? (
        <p className="w-full whitespace-normal break-words pl-[3.75rem] text-xs leading-snug text-muted-foreground">
          {child.notes}
        </p>
      ) : null}
    </div>
  );
}
