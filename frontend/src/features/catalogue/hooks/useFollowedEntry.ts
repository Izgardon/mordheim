import { useEffect } from "react";

type Row = { id: number; replaces?: number | null };

/** What the open entry's detail read says: its last answer, and whether the server has it. */
type OpenEntry = { entry: Row | null; gone: boolean };

/**
 * The entry the campaign now uses in place of the open one, or null: the campaign's version of
 * an open book entry, or, for an open version the server no longer has (`gone`) and the list no
 * longer holds, the book entry its last read (`open`) names.
 */
export function followedEntryId(rows: Row[], openEntryId: number | null, open: OpenEntry) {
  if (openEntryId === null) {
    return null;
  }
  const version = rows.find((row) => row.replaces === openEntryId);
  if (version) {
    return version.id;
  }
  const book = open.entry?.replaces ?? null;
  if (!open.gone || book === null || rows.some((row) => row.id === openEntryId)) {
    return null;
  }
  return rows.some((row) => row.id === book) ? book : null;
}

/**
 * A catalogue page's open entry follows another member's write as the writer's own does (a book
 * entry's first edit makes the campaign's version, which the list now holds in its place; a
 * Revert takes the version back to its book entry), so the panel never shows an entry the
 * campaign no longer uses. `rows` is the list (none in the Archived view); `follow` opens the id.
 */
export function useFollowedEntry(
  rows: Row[],
  openEntryId: number | null,
  open: OpenEntry,
  follow: (entryId: number) => void
) {
  const movedTo = followedEntryId(rows, openEntryId, open);
  useEffect(() => {
    if (movedTo !== null) {
      follow(movedTo);
    }
  }, [movedTo, follow]);
}
