/** One cursor page of a newest-first list (ECON-PERF-06): `next_cursor` is null on the last. */
export type CursorPage<T> = { results: T[]; next_cursor: string | null };

/** `?limit=N`, then any filters, then `&cursor=...` for every page after the first. */
export function pagePath(
  path: string,
  page: { limit: number; cursor?: string | null },
  filters: Record<string, string | undefined> = {}
) {
  const params = new URLSearchParams({ limit: String(page.limit) });
  for (const [name, value] of Object.entries(filters)) {
    if (value) {
      params.set(name, value);
    }
  }
  if (page.cursor) {
    params.set("cursor", page.cursor);
  }
  return `${path}?${params.toString()}`;
}
