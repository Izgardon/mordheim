import { useCatalogueSearchParams } from "./useCatalogueSearchParams";

/**
 * One page of a card list (Bestiary, Hired Swords) and the page number, kept in the query string
 * as `page` (from 2; CAT-NEW-02), so Back from an entry and a shared link land on it. A new search
 * or filter goes back to the first page by clearing `page` with its own change.
 */
export function usePagedList<T>(entries: T[], pageSize: number) {
  const url = useCatalogueSearchParams();
  const totalPages = Math.ceil(entries.length / pageSize);
  const asked = Math.max(0, (Number.parseInt(url.get("page"), 10) || 1) - 1);
  // A list that shrank (a narrower search from a link) shows its last page.
  const page = Math.min(asked, Math.max(0, totalPages - 1));
  const go = (next: number) => url.set({ page: next > 0 ? String(next + 1) : null });
  return {
    page,
    totalPages,
    paged: entries.slice(page * pageSize, (page + 1) * pageSize),
    previous: () => go(page - 1),
    next: () => go(page + 1),
  };
}
