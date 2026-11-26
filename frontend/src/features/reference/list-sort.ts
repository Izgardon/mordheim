import type { ColumnSort } from "./ReferenceList";
import type { SortOption } from "./SortMenu";

/** A list's orders as a phone's sort button offers them, the current one ticked. */
export type ListSortMenu<T extends string> = {
  options: ReadonlyArray<SortOption<T>>;
  value: T;
  onChange: (value: T) => void;
};

type SortParams = {
  get: (name: string, fallback?: string) => string;
  set: (changes: Record<string, string | null>) => void;
};

/**
 * A reference page's sort in `?sort=` (William, 26 Nov 2026): one of its orders, the first by
 * default (left out of the address). Each direction that matters is an order of its own ("Cost:
 * low to high", "Cost: high to low"), so a phone's menu and the web's headings pick the same ones.
 */
export function listSort<T extends string>(
  params: SortParams,
  options: ReadonlyArray<SortOption<T>>
) {
  const value = (options.find((option) => option.id === params.get("sort")) ?? options[0]).id;
  const set = (next: T) => params.set({ sort: next === options[0].id ? null : next });
  return {
    value,
    menu: { options, value, onChange: set } satisfies ListSortMenu<T>,
    /** A column heading's sort: its order, then (where it has one) the other way round. */
    heading: (first: T, other?: T): ColumnSort => ({
      direction: value === first ? "asc" : value === other ? "desc" : null,
      onSort: () => set(value === first && other ? other : first),
    }),
  };
}

/**
 * Two rows by a number, smallest first (largest with `descending`), a row with none last either
 * way; a tie is 0, so a stable sort keeps the rows' name order.
 */
export const byNumber =
  <R>(value: (row: R) => number | null | undefined, descending = false) =>
  (a: R, b: R) => {
    const [first, second] = [value(a), value(b)];
    if (first == null || second == null) return Number(first == null) - Number(second == null);
    return descending ? second - first : first - second;
  };
