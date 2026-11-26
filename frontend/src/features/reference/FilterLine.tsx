import type { ReactNode } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { FilterField, type ChipOption } from "./ReferenceFilters";
import SortMenu, { type SortOption } from "./SortMenu";

type FilterSelectProps<T extends string> = {
  /** The filter's name: "Type", "Setting". */
  label: string;
  options: ReadonlyArray<ChipOption<T>>;
  value: T;
  onChange: (value: T) => void;
  isMobile: boolean;
  /** The "all" option's name where "All" alone wouldn't say what: "All types". */
  allLabel?: string;
};

/** One of a reference page's filters as a dropdown, each choice with its count when given. */
export function FilterSelect<T extends string>(props: FilterSelectProps<T>) {
  const { isMobile } = props;
  const name = (option: ChipOption<T>) =>
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

type LineSort<S extends string> = {
  options: ReadonlyArray<SortOption<S>>;
  value: S;
  onChange: (value: S) => void;
};

/** The sort of a list kept in one order, by name: the button shows it, with nothing to change. */
export const BY_NAME_ONLY: LineSort<"name"> = {
  options: [{ id: "name", label: "Name" }],
  value: "name",
  onChange: () => {},
};

type FilterLineProps<S extends string> = {
  isMobile: boolean;
  /** The page's dropdowns in order (`FilterSelect`): its type, then its setting. */
  children?: ReactNode;
  /** The orders the list can take; the arrows button ends the line. */
  sort: LineSort<S>;
};

/**
 * A reference page's filters under its search (William, 26 Nov 2026): its type and its setting as
 * dropdowns, then the sort's arrows button, on one line on the web and on a phone.
 */
export function FilterLine<S extends string>({ isMobile, children, sort }: FilterLineProps<S>) {
  const button = <SortMenu {...sort} className={isMobile ? "h-9 w-10 shrink-0" : "h-11 w-11"} />;
  return (
    <div className={cn("flex items-end", isMobile ? "gap-2" : "flex-wrap gap-x-4 gap-y-2.5")}>
      {children}
      {isMobile ? (
        <div className="ml-auto flex shrink-0">{button}</div>
      ) : (
        <FilterField label="Sort" isMobile={false}>
          {button}
        </FilterField>
      )}
    </div>
  );
}
