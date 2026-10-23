import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useOutletContext, useParams } from "react-router-dom";

import { campaignCapabilities } from "@/features/campaigns/capabilities";
import { archivedOnly, useArchivedView } from "@/features/catalogue/hooks/useArchivedView";
import { useCatalogueSearchParams } from "@/features/catalogue/hooks/useCatalogueSearchParams";
import { useFollowedEntry } from "@/features/catalogue/hooks/useFollowedEntry";
import { usePagedList } from "@/features/catalogue/hooks/usePagedList";
import { useCatalogue } from "@/lib/catalogue-queries";

import { beastKindLabel, isBeastKind, type BeastKind } from "../bestiary-kinds";
import { useBestiaryEntryDetail } from "./useBestiaryEntryDetail";

import type { CampaignLayoutContext } from "@/features/campaigns/routes/CampaignLayout";
import type { NameMatch } from "@/lib/field-errors";
import type { BestiaryEntry, BestiaryEntrySummary } from "../types/bestiary-types";

const PAGE_SIZE = 12;

/** Whether the form is open, and on which beast (none: adding one). */
type FormState = { open: boolean; editingId: number | null };

/** The beast another page asked to edit (an Animal item's Edit on Wargear), if any. */
const editRequestOf = (state: unknown) => {
  const editEntry = (state as { editEntry?: unknown } | null)?.editEntry;
  return typeof editEntry === "number" ? editEntry : null;
};

/**
 * The Bestiary page: its list (or the Archived one), the kind, search and page, the open beast
 * (all in the URL, CAT-NEW-02), and the Add / Edit form. A write that moves the open beast (a book
 * beast's first edit makes the version, a Revert goes back to the book) follows it, whoever made
 * it; a delete closes it.
 */
export function useBestiaryPage() {
  const { id } = useParams();
  const { campaign } = useOutletContext<CampaignLayoutContext>();
  const campaignId = Number(id);
  const capabilities = campaignCapabilities(campaign);
  const archive = useArchivedView();
  const list = useCatalogue("bestiary", campaignId, archive.listOptions);
  const entries = useMemo(
    () => archivedOnly(archive.archived, list.data),
    [archive.archived, list.data]
  );
  const url = useCatalogueSearchParams();
  const searchQuery = url.get("q");
  const kindParam = url.get("kind");
  const kind: BeastKind | null = isBeastKind(kindParam) ? kindParam : null;
  const openEntryId = url.get("entry") ? Number(url.get("entry")) : null;
  // Arriving from an Animal item's Edit opens its beast's form once; the request is then dropped
  // from the history entry, so Back and Forward don't open it again.
  const location = useLocation();
  const navigate = useNavigate();
  const editRequest = capabilities.edit_catalogue ? editRequestOf(location.state) : null;
  const [form, setForm] = useState<FormState>(() =>
    editRequest === null ? { open: false, editingId: null } : { open: true, editingId: editRequest }
  );
  useEffect(() => {
    if (editRequestOf(location.state) !== null) {
      navigate({ pathname: location.pathname, search: location.search }, { replace: true });
    }
  }, [location.pathname, location.search, location.state, navigate]);

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const matching = entries.filter(
      (entry) =>
        (!kind || entry.kind === kind) &&
        (!query ||
          [entry.name, beastKindLabel(entry.kind), entry.description].some((text) =>
            text?.toLowerCase().includes(query)
          ))
    );
    // `filter` made a copy: the list is the shared query cache.
    return matching.sort((a, b) => a.name.localeCompare(b.name));
  }, [entries, kind, searchQuery]);
  const pages = usePagedList(filtered, PAGE_SIZE);

  const openDetail = useBestiaryEntryDetail(campaignId, openEntryId);
  const { set: setUrl } = url;
  const follow = useCallback((entryId: number) => setUrl({ entry: String(entryId) }), [setUrl]);
  useFollowedEntry(archive.archived ? [] : list.data, openEntryId, openDetail, follow);

  return {
    campaignId,
    canEdit: capabilities.edit_catalogue,
    canDelete: capabilities.delete_catalogue,
    archive,
    list,
    /** Every beast the list (or the Archived list) shows, before the kind and the search. */
    entries,
    filtered,
    pages,
    searchQuery,
    setSearchQuery: (q: string) => url.set({ q, page: null }),
    kind,
    setKind: (next: BeastKind | null) => url.set({ kind: next, page: null }),
    openEntryId,
    openEntry: (entry: BestiaryEntrySummary) => url.open({ entry: String(entry.id) }),
    closeEntry: () => url.back("entry"),
    form: {
      ...form,
      add: () => setForm({ open: true, editingId: null }),
      edit: (entryId: number) => setForm({ open: true, editingId: entryId }),
      onOpenChange: (open: boolean) => setForm((prev) => ({ ...prev, open })),
      onSaved: (saved: BestiaryEntry, editedId: number | null) => {
        if (openEntryId !== null && editedId === openEntryId && saved.id !== openEntryId) {
          url.set({ entry: String(saved.id) });
        }
      },
      onDeleted: (entryId: number) => {
        if (entryId === openEntryId) {
          url.back("entry");
        }
      },
      onReverted: (book: BestiaryEntrySummary) => {
        if (openEntryId !== null) {
          url.set({ entry: String(book.id) });
        }
      },
      onEditMatch: (match: NameMatch) => setForm({ open: true, editingId: match.id }),
    },
  };
}

export type BestiaryPageState = ReturnType<typeof useBestiaryPage>;
