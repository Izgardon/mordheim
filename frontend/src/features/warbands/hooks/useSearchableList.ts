import { useMemo, useState } from "react";

type UseSearchableListOptions<T> = {
  items: T[];
  searchKeys: (item: T) => string[];
  filterFn?: (item: T) => boolean;
};

export function useSearchableList<T>({ items, searchKeys, filterFn }: UseSearchableListOptions<T>) {
  const [query, setQuery] = useState("");

  const matchingItems = useMemo(() => {
    const searchTerm = query.trim().toLowerCase();
    const baseItems = filterFn ? items.filter(filterFn) : items;

    if (!searchTerm) {
      return baseItems;
    }

    return baseItems.filter((item) =>
      searchKeys(item).some((key) => key.toLowerCase().includes(searchTerm))
    );
  }, [items, query, filterFn, searchKeys]);

  return {
    query,
    setQuery,
    matchingItems,
  };
}

