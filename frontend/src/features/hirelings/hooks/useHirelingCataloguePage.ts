import { useCallback, useMemo, useState } from "react";
import { useOutletContext, useParams } from "react-router-dom";

import { campaignCapabilities } from "@/features/campaigns/capabilities";
import { archivedOnly, useArchivedView } from "@/features/catalogue/hooks/useArchivedView";
import { useCatalogueSearchParams } from "@/features/catalogue/hooks/useCatalogueSearchParams";
import { useFollowedEntry } from "@/features/catalogue/hooks/useFollowedEntry";
import { usePagedList } from "@/features/catalogue/hooks/usePagedList";
import { useCatalogue } from "@/lib/catalogue-queries";

import { hirelingRace } from "../hireling-catalogue-kinds";
import { useHirelingProfileDetail } from "./useHirelingProfileDetail";

import type { CampaignLayoutContext } from "@/features/campaigns/routes/CampaignLayout";
import type { NameMatch } from "@/lib/field-errors";
import type { HirelingCatalogueConfig } from "../hireling-catalogue-kinds";
import type { HirelingProfile, HirelingProfileDetail } from "../types/hireling-catalogue-types";

const PAGE_SIZE = 12;

/** Whether the form is open, and on which entry (none: adding one). */
type FormState = { open: boolean; editingId: number | null };

/**
 * A hired-sword or dramatis-persona catalogue page: its list (or the Archived one), the search and
 * page, the open entry (all in the URL, CAT-NEW-02), and the Add / Edit form. A write that moves
 * the open entry (a book entry's first edit makes the version, a Revert goes back to the book)
 * follows it, whoever made it; a delete closes it.
 */
export function useHirelingCataloguePage(config: HirelingCatalogueConfig) {
  const { id } = useParams();
  const { campaign } = useOutletContext<CampaignLayoutContext>();
  const campaignId = Number(id);
  const capabilities = campaignCapabilities(campaign);
  const archive = useArchivedView();
  const list = useCatalogue(config.kind, campaignId, archive.listOptions);
  const entries = useMemo(
    () => archivedOnly(archive.archived, list.data),
    [archive.archived, list.data]
  );
  const url = useCatalogueSearchParams();
  const searchQuery = url.get("q");
  const openEntryId = url.get("entry") ? Number(url.get("entry")) : null;
  const [form, setForm] = useState<FormState>({ open: false, editingId: null });

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const matching = query
      ? entries.filter((entry) =>
          [entry.name, entry.description, hirelingRace(entry)].some((text) =>
            text?.toLowerCase().includes(query)
          )
        )
      : entries.slice();
    // A copy: the list is the shared query cache.
    return matching.sort((a, b) => a.name.localeCompare(b.name));
  }, [entries, searchQuery]);
  const pages = usePagedList(filtered, PAGE_SIZE);

  // Another member's write moves the open entry as the writer's own does (a book entry's first
  // edit makes the campaign's version, which the list now holds in its place; a Revert takes the
  // version back to its book entry), so the panel follows it rather than show an entry the
  // campaign no longer uses.
  const openDetail = useHirelingProfileDetail(config.kind, campaignId, openEntryId);
  const { set: setUrl } = url;
  const follow = useCallback((entryId: number) => setUrl({ entry: String(entryId) }), [setUrl]);
  useFollowedEntry(archive.archived ? [] : list.data, openEntryId, openDetail, follow);

  return {
    config,
    campaignId,
    canEdit: capabilities.edit_catalogue,
    canDelete: capabilities.delete_catalogue,
    archive,
    list,
    /** Every entry the list (or the Archived list) shows, before the search. */
    entries,
    filtered,
    pages,
    searchQuery,
    setSearchQuery: (q: string) => url.set({ q, page: null }),
    openEntryId,
    openEntry: (entry: HirelingProfile) => url.open({ entry: String(entry.id) }),
    closeEntry: () => url.back("entry"),
    form: {
      ...form,
      add: () => setForm({ open: true, editingId: null }),
      edit: (entryId: number) => setForm({ open: true, editingId: entryId }),
      onOpenChange: (open: boolean) => setForm((prev) => ({ ...prev, open })),
      onSaved: (saved: HirelingProfileDetail, editedId: number | null) => {
        if (openEntryId !== null && editedId === openEntryId && saved.id !== openEntryId) {
          url.set({ entry: String(saved.id) });
        }
      },
      onDeleted: (entryId: number) => {
        if (entryId === openEntryId) {
          url.back("entry");
        }
      },
      onReverted: (book: HirelingProfile) => {
        if (openEntryId !== null) {
          url.set({ entry: String(book.id) });
        }
      },
      onEditMatch: (match: NameMatch) => setForm({ open: true, editingId: match.id }),
    },
  };
}

export type HirelingCataloguePageState = ReturnType<typeof useHirelingCataloguePage>;
