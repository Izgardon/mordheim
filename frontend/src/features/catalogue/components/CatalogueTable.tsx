import { Fragment, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";

import { ImageScrollArea } from "@components/image-scroll-area";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/** One desktop column: its header and how a row fills its cell. */
export type CatalogueColumn<T> = {
  key: string;
  label: string;
  headerClassName?: string;
  cellClassName?: string;
  render: (row: T) => ReactNode;
};

/** A phone shows the name, one more column and the actions; the rest opens under the row. */
export type CatalogueMobileLayout<T> = {
  name: (row: T) => ReactNode;
  second: { label: string; className: string; render: (row: T) => ReactNode };
  actions: (row: T) => ReactNode;
  details: (row: T) => ReactNode;
  detailsClassName?: string;
};

type CatalogueTableProps<T> = {
  rows: T[];
  getRowId: (row: T) => string;
  columns: CatalogueColumn<T>[];
  mobile: CatalogueMobileLayout<T>;
  isMobile?: boolean;
  /** Desktop rows open to show this under them (Wargear); without it they don't open. */
  desktopDetails?: (row: T) => ReactNode;
  /** The header stays put while the rows scroll. */
  stickyHeader?: boolean;
  /** The open rows, when the page holds them; otherwise the table does. */
  expanded?: { ids: string[]; toggle: (rowId: string) => void };
};

const HEAD = "table-head-surface border-b border-border/60 uppercase tracking-[0.2em]";
const BODY = "divide-y divide-border/60 border-b border-border/60";
const stripe = (index: number) =>
  index % 2 === 0 ? "table-row-even table-row-hover" : "table-row-odd table-row-hover";

/** What makes a row open and close: a click, Enter or Space. */
function toggleProps(isExpanded: boolean, toggle: () => void) {
  return {
    onClick: toggle,
    role: "button",
    "aria-expanded": isExpanded,
    tabIndex: 0,
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggle();
      }
    },
  };
}

function Chevron({ isExpanded }: { isExpanded: boolean }) {
  return (
    <ChevronDown
      className={cn(
        "h-4 w-4 transition-transform",
        isExpanded ? "rotate-0 text-foreground" : "-rotate-90 text-muted-foreground"
      )}
      aria-hidden="true"
    />
  );
}

/**
 * The catalogue pages' table (Wargear, Skills, Spells): the columns on a desktop, rows that may
 * open to show more; on a phone the name, one column and the actions, each row opening to the rest.
 */
export default function CatalogueTable<T>({
  rows,
  getRowId,
  columns,
  mobile,
  isMobile,
  desktopDetails,
  stickyHeader = false,
  expanded,
}: CatalogueTableProps<T>) {
  const [ownExpanded, setOwnExpanded] = useState<string[]>([]);
  const expandedIds = expanded?.ids ?? ownExpanded;
  const toggle =
    expanded?.toggle ??
    ((rowId: string) =>
      setOwnExpanded((prev) =>
        prev.includes(rowId) ? prev.filter((id) => id !== rowId) : [...prev, rowId]
      ));

  return (
    <ImageScrollArea
      className="table-scroll table-scroll--full flex-1 min-h-0"
      showScrollbar={false}
    >
      {isMobile ? (
        <table className="min-w-full table-fixed divide-y border border-border/60 text-xs">
          <thead className={cn(HEAD, "text-[0.55rem] text-muted-foreground")}>
            <tr>
              <th className="w-8 px-2 py-2 text-left font-semibold">
                <span className="sr-only">Expand</span>
              </th>
              <th className="px-2 py-2 text-left font-semibold">Name</th>
              <th className={cn(mobile.second.className, "px-2 py-2 text-left font-semibold")}>
                {mobile.second.label}
              </th>
              <th className="w-[22%] px-2 py-2 text-left font-semibold"></th>
            </tr>
          </thead>
          <tbody className={BODY}>
            {rows.map((row, index) => {
              const rowId = getRowId(row);
              const isExpanded = expandedIds.includes(rowId);
              return (
                <Fragment key={rowId}>
                  <tr
                    className={cn("cursor-pointer transition-colors", stripe(index))}
                    {...toggleProps(isExpanded, () => toggle(rowId))}
                  >
                    <td className="px-2 py-2">
                      <Chevron isExpanded={isExpanded} />
                    </td>
                    <td className="px-2 py-2 font-medium text-foreground">{mobile.name(row)}</td>
                    <td className="px-2 py-2 text-muted-foreground">{mobile.second.render(row)}</td>
                    <td
                      className="px-2 py-2 whitespace-nowrap"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {mobile.actions(row)}
                    </td>
                  </tr>
                  {isExpanded ? (
                    <tr className="bg-background/50">
                      <td colSpan={4} className={cn("px-4 py-3", mobile.detailsClassName)}>
                        {mobile.details(row)}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      ) : (
        <table className="min-w-full table-fixed border border-border/60 text-sm">
          <thead
            className={cn(
              HEAD,
              "text-xs text-muted-foreground",
              stickyHeader && "sticky top-0 z-10"
            )}
          >
            <tr>
              {desktopDetails ? (
                <th className="w-10 px-4 py-3 text-left font-semibold">
                  <span className="sr-only">Expand</span>
                </th>
              ) : null}
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn("px-4 py-3 text-left font-semibold", column.headerClassName)}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={BODY}>
            {rows.map((row, index) => {
              const rowId = getRowId(row);
              const isExpanded = Boolean(desktopDetails) && expandedIds.includes(rowId);
              return (
                <Fragment key={rowId}>
                  <tr
                    className={cn(
                      "transition-colors",
                      desktopDetails && "cursor-pointer",
                      stripe(index)
                    )}
                    {...(desktopDetails ? toggleProps(isExpanded, () => toggle(rowId)) : {})}
                  >
                    {desktopDetails ? (
                      <td className="px-4 py-3">
                        <Chevron isExpanded={isExpanded} />
                      </td>
                    ) : null}
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={cn("px-4 py-3 text-muted-foreground", column.cellClassName)}
                      >
                        {column.render(row)}
                      </td>
                    ))}
                  </tr>
                  {isExpanded && desktopDetails ? (
                    <tr className="bg-background/50">
                      <td
                        colSpan={columns.length + 1}
                        className="px-4 py-3 text-sm text-foreground/90"
                      >
                        {desktopDetails(row)}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      )}
    </ImageScrollArea>
  );
}
