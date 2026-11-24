import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { cn } from "@/lib/utils";

import type { ColumnSort } from "./ReferenceList";

const SORT_ICONS = { asc: ArrowUp, desc: ArrowDown, none: ArrowUpDown };

/** A heading's text, or a button sorting the list by its column when it has a sort. */
export function HeadLabel({ label, sort }: { label?: string; sort?: ColumnSort }) {
  if (!sort) return <>{label}</>;
  const Icon = SORT_ICONS[sort.direction ?? "none"];
  return (
    <button
      type="button"
      onClick={sort.onSort}
      aria-label={`Sort by ${label}`}
      aria-pressed={sort.direction !== null}
      className={cn(
        "inline-flex items-center gap-1 uppercase hover:text-head",
        sort.direction && "text-text2"
      )}
    >
      {label}
      <Icon className="h-3 w-3" aria-hidden="true" />
    </button>
  );
}
