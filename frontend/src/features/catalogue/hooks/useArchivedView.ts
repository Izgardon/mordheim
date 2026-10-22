import { useCatalogueSearchParams } from "./useCatalogueSearchParams";

/**
 * Whether a catalogue page shows its Archived list (`?archived=1` in the URL, CAT-NEW-02): the
 * campaign's archived entries and the book entries removed for it (CAT-TWEAK-04, CAT-NEW-05).
 */
/** What a page lists: in the Archived view, only what is archived or removed. */
export const archivedOnly = <T extends { archived_at?: string | null }>(
  archived: boolean,
  entries: T[]
) => (archived ? entries.filter((entry) => entry.archived_at) : entries);

export function useArchivedView() {
  const url = useCatalogueSearchParams();
  const archived = url.get("archived") === "1";
  return {
    archived,
    setArchived: (on: boolean) => url.set({ archived: on ? "1" : null }),
    /** The list to read: the Archived one is cached on its own. */
    listOptions: archived ? ({ variant: "archived" } as const) : {},
  };
}
