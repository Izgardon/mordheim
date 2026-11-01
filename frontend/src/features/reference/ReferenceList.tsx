import { createContext, useContext, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** A web column after the name: its heading and the width class its cells share. */
export type ReferenceColumn = { label: string; className: string };

const ColumnsContext = createContext<ReferenceColumn[]>([]);

const HEAD = "py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-faint";

type ReferenceListProps = {
  /** The first column's heading on the web ("Item"); with `columns`, a header row shows. */
  nameLabel?: string;
  /** The web's columns after the name; a phone shows each row's `aside` instead. */
  columns?: ReferenceColumn[];
  /** Shown in place of the rows when there are none. */
  empty?: ReactNode;
  children: ReactNode;
  isEmpty: boolean;
};

/** The reference pages' list: one bordered box of rows, with a header row on the web. */
export function ReferenceList({
  nameLabel,
  columns = [],
  empty,
  children,
  isEmpty,
}: ReferenceListProps) {
  return (
    <ColumnsContext.Provider value={columns}>
      <div className="border border-border bg-surface">
        {columns.length ? (
          <div className="flex items-center gap-3 border-b border-border bg-rail px-4">
            {/* pl: a row's chevron (14px) and its gap (12px) */}
            <span className={cn(HEAD, "min-w-0 flex-1 pl-[26px]")}>{nameLabel}</span>
            {columns.map((column) => (
              <span key={column.label} className={cn(HEAD, column.className)}>
                {column.label}
              </span>
            ))}
          </div>
        ) : null}
        {isEmpty ? (
          <p className="m-0 px-4 py-6 text-sm text-text2">{empty}</p>
        ) : (
          <ul className="m-0 list-none p-0">{children}</ul>
        )}
      </div>
    </ColumnsContext.Provider>
  );
}

/** The DOM id of a row, which Search everything's links scroll to. */
export const rowDomId = (id: string) => `ref-${id}`;

type ReferenceRowProps = {
  /** The row's key in `?open=`: unique on its page. */
  id: string;
  open: boolean;
  onToggle: () => void;
  name: ReactNode;
  /** The line under the name: kind, list, lore. */
  sub?: ReactNode;
  /** A short warning under the name: "Skaven only". */
  warn?: string;
  /** Greyed: restricted for your warband. */
  dim?: boolean;
  /** The web's cells, one per column of the list. */
  cells?: ReactNode[];
  /** The right side of a row with no cells (a phone): price and rarity, a fee. */
  aside?: ReactNode;
  /** What the open row shows. */
  children?: ReactNode;
};

/** One row: its name, kind and figures; it opens in place to its rules and actions. */
export function ReferenceRow(props: ReferenceRowProps) {
  const columns = useContext(ColumnsContext);
  const { open } = props;
  return (
    <li
      id={rowDomId(props.id)}
      className={cn("scroll-mt-24 border-t border-line first:border-t-0", open && "bg-raised")}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={props.onToggle}
        className={cn(
          "flex min-h-14 w-full items-center gap-3 bg-transparent py-2 text-left",
          props.cells ? "px-4" : "px-3"
        )}
      >
        {props.cells ? (
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
              open ? "rotate-0" : "-rotate-90"
            )}
          />
        ) : null}
        <span className="flex min-w-0 flex-1 flex-col gap-px">
          <span className={cn("text-[15px] font-bold", props.dim ? "text-text2" : "text-head")}>
            {props.name}
          </span>
          {props.sub ? <span className="text-xs text-muted-foreground">{props.sub}</span> : null}
          {props.warn ? (
            <span className="text-xs font-semibold text-danger">{props.warn}</span>
          ) : null}
        </span>
        {props.cells
          ? props.cells.map((cell, index) => (
              <span
                key={columns[index]?.label ?? index}
                className={cn(
                  "flex flex-col gap-px text-[13px]",
                  props.dim ? "text-muted-foreground" : "text-text2",
                  columns[index]?.className
                )}
              >
                {cell}
              </span>
            ))
          : null}
        {!props.cells && props.aside ? (
          <span className="flex shrink-0 flex-col items-end">{props.aside}</span>
        ) : null}
        {props.cells ? null : (
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180"
            )}
          />
        )}
      </button>
      {open && props.children ? (
        <div className={props.cells ? "" : "px-3 pb-3.5"}>{props.children}</div>
      ) : null}
    </li>
  );
}

/** Price over rarity, right-aligned (a row's aside or a cell). */
export function PriceRarity({
  price,
  rarity,
  rare,
}: {
  price: string;
  rarity: string;
  rare: boolean;
}) {
  return (
    <>
      <span className="font-mono text-[13px] font-bold text-ink">{price}</span>
      <span className={cn("text-xs", rare ? "text-accent-text" : "text-muted-foreground")}>
        {rarity}
      </span>
    </>
  );
}

/**
 * The rows a long list shows: the first `step`, more on asking, and never fewer than reach the
 * open row (a link from Search everything).
 */
export function useShownRows<T>(rows: T[], openIndex: number, step = 60) {
  const [limit, setLimit] = useState(step);
  const shown = Math.max(limit, openIndex + 1);
  return {
    rows: rows.slice(0, shown),
    more: Math.max(0, rows.length - shown),
    showMore: () => setLimit(shown + step),
  };
}

/** "Showing 60 of 247" and the button for the next ones. */
export function ShowMore({
  shown,
  total,
  onMore,
  sorted,
}: {
  shown: number;
  total: number;
  onMore: () => void;
  /** "sorted by name". */
  sorted?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-[13px] text-muted-foreground">
        Showing {shown} of {total}
        {sorted ? `, ${sorted}` : ""}
      </span>
      {shown < total ? (
        <Button variant="secondary" className="min-h-11" onClick={onMore}>
          Show {Math.min(60, total - shown)} more
        </Button>
      ) : null}
    </div>
  );
}
