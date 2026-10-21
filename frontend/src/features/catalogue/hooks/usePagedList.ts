import { useEffect, useState } from "react";

/**
 * One page of a card list (Bestiary, Hired Swords) and the page number, back to the first
 * page whenever `resetKey` changes (a new search or filter). Call it in the route, so the page
 * outlasts opening an entry and coming Back.
 */
export function usePagedList<T>(entries: T[], pageSize: number, resetKey: string) {
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [resetKey]);

  const totalPages = Math.ceil(entries.length / pageSize);
  return {
    page,
    totalPages,
    paged: entries.slice(page * pageSize, (page + 1) * pageSize),
    previous: () => setPage((p) => p - 1),
    next: () => setPage((p) => p + 1),
  };
}
