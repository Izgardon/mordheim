import { useMemo, useState } from "react";

export const ALL_TYPES = "all";

type UseCatalogueFiltersOptions<T> = {
  /** The text a search looks in. */
  haystack: (entry: T) => (string | null | undefined)[];
  /** The list's order. */
  compare: (a: T, b: T) => number;
};

/**
 * A catalogue page's search and type filter (Skills, Spells): the types the list uses, sorted,
 * and the entries of the chosen type whose text holds the search, in the page's order. Pass
 * module-level `haystack` and `compare` so the list is only rebuilt when the entries change.
 */
export function useCatalogueFilters<T extends { type?: string | null }>(
  entries: T[],
  { haystack, compare }: UseCatalogueFiltersOptions<T>
) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState(ALL_TYPES);

  const typeOptions = useMemo(() => {
    const unique = new Set(entries.map((entry) => entry.type).filter(Boolean) as string[]);
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [entries]);

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const byType =
      selectedType === ALL_TYPES ? entries : entries.filter((entry) => entry.type === selectedType);
    const matching = query
      ? byType.filter((entry) =>
          haystack(entry).filter(Boolean).join(" ").toLowerCase().includes(query)
        )
      : byType.slice();
    return matching.sort(compare);
  }, [compare, entries, haystack, searchQuery, selectedType]);

  return { searchQuery, setSearchQuery, selectedType, setSelectedType, typeOptions, filtered };
}
