import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

/*
 * Loading skeletons (design E): square bars in the line colour, pulsing, laid out like the page
 * they stand in for (its columns, sections, row heights and dividers), so nothing jumps when the
 * page arrives. Each page builds its own skeleton from these; the shell shows it while the page's
 * code or data loads.
 */

/** One placeholder bar. Its size comes from `className` (or `style`). */
export function Bone({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <span
      aria-hidden="true"
      className={cn("block animate-pulse bg-line", className)}
      style={style}
    />
  );
}

/** A loading page or list: says so to screen readers once; its bars are hidden from them. */
export function SkeletonPage({
  label,
  className,
  children,
}: {
  /** "Loading the overview". */
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className={className}>
      {children}
    </div>
  );
}

/** A page header: the kicker over the 40 px title, and the page's buttons on the right. */
export function SkeletonHeader({
  buttons = 0,
  title = "w-[min(420px,70%)]",
  className,
}: {
  /** How many buttons sit on the right. */
  buttons?: number;
  /** The title bar's width class. */
  title?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-5", className)}>
      <div className="flex min-w-0 flex-1 flex-col gap-3 py-1">
        <Bone className="h-3 w-40" />
        <Bone className={cn("h-9 max-[960px]:h-7", title)} />
      </div>
      {buttons ? (
        <div className="flex gap-2">
          {Array.from({ length: buttons }, (_, index) => (
            <Bone key={index} className="h-11 w-[140px]" />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** A caption and a count over a hairline ("Your campaigns · 3 campaigns"). */
export function SkeletonCaptionRow({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex items-center justify-between gap-3 border-b border-line pb-3", className)}
    >
      <Bone className="h-2.5 w-28" />
      <Bone className="h-2.5 w-20" />
    </div>
  );
}

/** A stats line between hairlines: a caption over a figure in each cell. */
export function SkeletonStats({ cells, className }: { cells: number; className?: string }) {
  return (
    <div
      className={cn("grid border-y border-line", className)}
      style={{ gridTemplateColumns: `repeat(${cells}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: cells }, (_, index) => (
        <div key={index} className="flex flex-col gap-2.5 py-3.5 pr-4">
          <Bone className="h-2.5 w-16 max-w-full" />
          <Bone className="h-6 w-10" />
        </div>
      ))}
    </div>
  );
}

/** Underline tabs over a hairline, the first one current. */
export function SkeletonTabs({ tabs, className }: { tabs: number; className?: string }) {
  return (
    <div className={cn("flex gap-7 border-b border-line pb-3 pt-2.5", className)}>
      {Array.from({ length: tabs }, (_, index) => (
        <Bone key={index} className={cn("h-3.5", index ? "w-16" : "w-14 bg-strong")} />
      ))}
    </div>
  );
}

/** A section title (22 px Fraunces) with its small meta. */
export function SkeletonHeading({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 py-1", className)}>
      <Bone className="h-5 w-32" />
      <Bone className="h-3 w-16" />
    </div>
  );
}

// Fixed widths, so the rows differ but never jump between renders.
const WIDTHS = ["58%", "72%", "46%", "64%", "52%", "68%"];

/** A width from the fixed set, for the nth bar of a list. */
export const boneWidth = (index: number) => WIDTHS[index % WIDTHS.length];

const CAPS = [240, 300, 190, 270, 210, 280];

/** A name's width in a row: a share of the row, capped so that wide rows still differ. */
export const nameWidth = (index: number) =>
  `min(${boneWidth(index)}, ${CAPS[index % CAPS.length]}px)`;

/** One row: a name over a short line, then `cells` short figures on the right. */
export function SkeletonRow({
  index = 0,
  cells = 1,
  className,
}: {
  index?: number;
  cells?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-14 items-center gap-6 px-4 py-2.5", className)}>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Bone className="h-3.5" style={{ width: nameWidth(index) }} />
        <Bone className="h-2.5 w-24" />
      </div>
      {Array.from({ length: cells }, (_, cell) => (
        <Bone key={cell} className="h-3 w-14 shrink-0" />
      ))}
    </div>
  );
}

/**
 * Rows in one bordered box, divided by hairlines, with a header row of column titles if `head`.
 * `rowClass` sets each row's height to match the real list's.
 */
export function SkeletonRows({
  rows,
  cells = 1,
  head = false,
  rowClass,
  className,
}: {
  rows: number;
  cells?: number;
  head?: boolean;
  rowClass?: string;
  className?: string;
}) {
  return (
    <div className={cn("border border-border bg-surface", className)}>
      {head ? (
        <div className="flex h-10 items-center gap-6 border-b border-border bg-raised px-4">
          <Bone className="h-2.5 w-20" />
          <span className="flex-1" />
          {Array.from({ length: cells }, (_, index) => (
            <Bone key={index} className="h-2.5 w-14" />
          ))}
        </div>
      ) : null}
      {Array.from({ length: rows }, (_, index) => (
        <SkeletonRow
          key={index}
          index={index}
          cells={cells}
          className={cn(index ? "border-t border-line" : null, rowClass)}
        />
      ))}
    </div>
  );
}

/** A card (surface, border): a title over a few lines, then anything else it holds. */
export function SkeletonCard({
  lines = 2,
  className,
  children,
}: {
  lines?: number;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-3.5 border border-border bg-surface p-5", className)}>
      <Bone className="h-5 w-40" />
      {Array.from({ length: lines }, (_, index) => (
        <Bone key={index} className="h-3" style={{ width: boneWidth(index + 2) }} />
      ))}
      {children}
    </div>
  );
}
