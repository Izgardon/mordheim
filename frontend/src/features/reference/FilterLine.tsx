import { Children, type ReactNode } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import type { ListSortMenu } from "./list-sort";
import { FilterField } from "./ReferenceFilters";
import SortMenu from "./SortMenu";

export type FilterOption<T extends string> = { id: T; label: string; count?: number };

type FilterSelectProps<T extends string> = {
  /** The filter's name: "Type", "Setting". */
  label: string;
  options: ReadonlyArray<FilterOption<T>>;
  value: T;
  onChange: (value: T) => void;
  isMobile: boolean;
  /** The "all" option's name where "All" alone wouldn't say what: "All types". */
  allLabel?: string;
};

/** One of a reference page's filters as a dropdown, each choice with its count when given. */
export function FilterSelect<T extends string>(props: FilterSelectProps<T>) {
  const { isMobile } = props;
  const name = (option: FilterOption<T>) =>
    option.id === "all" && props.allLabel ? props.allLabel : option.label;
  const current = props.options.find((option) => option.id === props.value);
  return (
    <FilterField label={props.label} isMobile={isMobile} className="w-[240px]">
      <Select value={props.value} onValueChange={(next) => props.onChange(next as T)}>
        <SelectTrigger
          aria-label={props.label}
          className={cn("bg-rail", isMobile && "min-w-0 flex-1 pl-3 pr-2")}
        >
          <SelectValue>{current ? name(current) : ""}</SelectValue>
        </SelectTrigger>
        <SelectContent className="w-auto min-w-[var(--radix-select-trigger-width)] max-w-[min(320px,calc(100vw-32px))]">
          {props.options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {name(option)}
              {option.count !== undefined ? (
                <span className="ml-2 font-mono text-[11px] text-faint">{option.count}</span>
              ) : null}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FilterField>
  );
}

type FilterLineProps<S extends string> = {
  isMobile: boolean;
  /** The page's dropdowns in order (`FilterSelect`): its type, then its setting. */
  children?: ReactNode;
  /** The list's orders: a phone's arrows button at the line's right edge (the web's headings sort). */
  sort?: ListSortMenu<S>;
};

/**
 * A reference page's filters under its search (William, 26 Nov 2026): its type and its setting as
 * dropdowns on one line, and on a phone the sort's arrows button at the right edge, where the list
 * has more than one order.
 */
export function FilterLine<S extends string>({ isMobile, children, sort }: FilterLineProps<S>) {
  const filters = Children.toArray(children);
  const button = isMobile && sort && sort.options.length > 1;
  if (!filters.length && !button) return null;
  return (
    <div className={cn("flex items-end", isMobile ? "gap-2" : "flex-wrap gap-x-4 gap-y-2.5")}>
      {filters}
      {button ? (
        <div className="ml-auto flex shrink-0">
          <SortMenu {...sort} className="h-9 w-10" />
        </div>
      ) : null}
    </div>
  );
}
