import { TableSkeleton } from "@/components/ui/table-skeleton";
import { RestoreButton } from "@/features/catalogue/components/ArchivedView";
import CataloguePager from "@/features/catalogue/components/CataloguePager";

import BestiaryEntryCard from "./BestiaryEntryCard";

import type { BestiaryFavourites } from "../hooks/useBestiaryFavourites";
import type { BestiaryPageState } from "../hooks/useBestiaryPage";

/**
 * The beasts, a page at a time, or why there are none: still loading, a failed read, nothing
 * archived, or a kind and search that matched nothing. Your warband's favourites are starred. In
 * the Archived list a card offers Restore (to `edit_catalogue` holders) and doesn't open.
 */
export default function BestiaryList({
  page,
  favourites,
}: {
  page: BestiaryPageState;
  /** Your warband's stars; none for a member without a warband. */
  favourites: BestiaryFavourites | null;
}) {
  const { archive, list, pages } = page;

  let body;
  if (list.isLoading) {
    body = <TableSkeleton columns={4} rows={8} />;
  } else if (list.error) {
    body = <p className="text-sm text-red-600">{list.error}</p>;
  } else if (archive.archived && page.entries.length === 0) {
    body = <p className="text-sm text-muted-foreground">Nothing archived.</p>;
  } else if (page.filtered.length === 0) {
    body = <p className="text-sm text-muted-foreground">No bestiary entries found.</p>;
  } else {
    body = (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {pages.paged.map((entry) => (
          <BestiaryEntryCard
            key={entry.id}
            entry={entry}
            onClick={archive.archived ? undefined : page.openEntry}
            isFavourite={favourites?.favouriteIds.has(entry.id)}
            onToggleFavourite={favourites && !archive.archived ? favourites.toggle : undefined}
            actionSlot={
              archive.archived && page.canEdit ? (
                <RestoreButton kind="bestiary" campaignId={page.campaignId} entry={entry} />
              ) : null
            }
          />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto">{body}</div>
      <CataloguePager {...pages} />
    </>
  );
}
