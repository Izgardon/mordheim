import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { CatalogueEntryKind } from "@/features/catalogue/api/catalogue-entry-api";
import { useCatalogueRestore } from "@/features/catalogue/hooks/useNameTakenMatches";
import type { CatalogueEntryLike } from "@/features/catalogue/types/catalogue-entry";
import { useCatalogue } from "@/lib/catalogue-queries";
import { getRefusalMessage } from "@/lib/get-error-message";

/** What the reference layout needs to list a page's archived entries. */
export type ArchivedOptions = {
  kind: CatalogueEntryKind;
  campaignId: number;
  /** `edit_catalogue`: Restore shows. */
  canRestore: boolean;
  /** "items", "skills": the empty line and the heading. */
  noun: string;
};

const archivedOn = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" }) : "";

/** One archived row's Restore: back in the campaign's lists, store and pickers. */
function RestoreButton({
  options,
  entry,
}: {
  options: ArchivedOptions;
  entry: CatalogueEntryLike;
}) {
  const restore = useCatalogueRestore(options.kind, options.campaignId);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      await restore(entry);
      toast.success(`${entry.name} is back.`);
    } catch (failure) {
      toast.error(`Couldn't restore ${entry.name}.`, {
        description: getRefusalMessage(failure, "Please try again."),
      });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button
      size="sm"
      variant="secondary"
      aria-label={`Restore ${entry.name}`}
      disabled={busy}
      onClick={() => void run()}
    >
      {busy ? "Restoring…" : "Restore"}
    </Button>
  );
}

/**
 * A reference page's archived entries (CAT-TWEAK-04, CAT-NEW-05), under its list while Show archived
 * is on: the campaign's own entries archived because something still held them, and book entries
 * removed for the campaign, greyed, each with Restore for those who edit the catalogue.
 */
export default function ArchivedEntries({ options }: { options: ArchivedOptions }) {
  const list = useCatalogue(options.kind, options.campaignId, { variant: "archived" });
  const archived = (list.data as CatalogueEntryLike[]).filter((entry) => entry.archived_at);
  return (
    <section aria-label={`Archived ${options.noun}`} className="flex flex-col gap-2.5">
      <h2 className="m-0 text-[11px] font-bold uppercase tracking-[0.14em] text-faint">
        Archived {options.noun}
      </h2>
      <div className="border border-border bg-surface">
        {list.isLoading ? (
          <p className="m-0 px-4 py-5 text-sm text-muted-foreground">Opening the archive…</p>
        ) : list.error ? (
          <p className="m-0 px-4 py-5 text-sm text-danger">{list.error}</p>
        ) : archived.length === 0 ? (
          <p className="m-0 px-4 py-5 text-sm text-text2">No archived {options.noun}.</p>
        ) : (
          <ul className="m-0 list-none p-0">
            {archived.map((entry) => {
              const date = archivedOn(entry.archived_at);
              const removed = entry.campaign_id == null;
              return (
                <li
                  key={entry.id}
                  className="flex min-h-14 items-center gap-3 border-t border-line px-4 py-2 first:border-t-0"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-px">
                    <span className="text-[15px] font-bold text-text2">{entry.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {removed ? "Book entry removed from this campaign" : "Archived"}
                      {date ? ` · ${date}` : ""}
                    </span>
                  </span>
                  {options.canRestore ? <RestoreButton options={options} entry={entry} /> : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
