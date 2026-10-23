import { TableSkeleton } from "@/components/ui/table-skeleton";
import { RestoreButton } from "@/features/catalogue/components/ArchivedView";
import CataloguePager from "@/features/catalogue/components/CataloguePager";

import HirelingProfileCard from "./HirelingProfileCard";

import type { HirelingCataloguePageState } from "../hooks/useHirelingCataloguePage";

/** The catalogue holds none of the kind: what the kind is, and how to add one. */
function EmptyCatalogue({ page }: { page: HirelingCataloguePageState }) {
  const { labels } = page.config;
  return (
    <div
      role="status"
      className="mx-auto max-w-prose space-y-2 rounded border border-dashed border-border/60 px-6 py-10 text-center"
    >
      <p className="font-display text-lg text-foreground">{labels.emptyTitle}</p>
      <p className="text-sm text-muted-foreground">{labels.emptyBody}</p>
      {page.canEdit ? <p className="text-sm text-muted-foreground">{labels.emptyAddHint}</p> : null}
    </div>
  );
}

/**
 * The cards, a page at a time, or why there are none: still loading, a failed read, nothing
 * archived, an empty catalogue, or a search that matched nothing. In the Archived list a card
 * offers Restore (to `edit_catalogue` holders) and doesn't open.
 */
export default function HirelingCatalogueList({ page }: { page: HirelingCataloguePageState }) {
  const { config, archive, list, pages } = page;

  let body;
  if (list.isLoading) {
    body = <TableSkeleton columns={4} rows={8} />;
  } else if (list.error) {
    body = <p className="text-sm text-red-600">{list.error}</p>;
  } else if (page.entries.length === 0) {
    body = archive.archived ? (
      <p className="text-sm text-muted-foreground">Nothing archived.</p>
    ) : (
      <EmptyCatalogue page={page} />
    );
  } else if (page.filtered.length === 0) {
    body = (
      <p className="text-sm text-muted-foreground">
        {config.labels.noMatches} &ldquo;{page.searchQuery.trim()}&rdquo;.
      </p>
    );
  } else {
    body = (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {pages.paged.map((entry) => (
          <HirelingProfileCard
            key={entry.id}
            config={config}
            entry={entry}
            onOpen={archive.archived ? undefined : page.openEntry}
            action={
              archive.archived && page.canEdit ? (
                <RestoreButton kind={config.kind} campaignId={page.campaignId} entry={entry} />
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
