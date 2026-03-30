export function matchesSearchQuery(query: string, ...values: Array<string | null | undefined>) {
  const searchTerm = query.trim().toLowerCase();

  if (!searchTerm) {
    return true;
  }

  return values.some((value) => value?.toLowerCase().includes(searchTerm));
}
