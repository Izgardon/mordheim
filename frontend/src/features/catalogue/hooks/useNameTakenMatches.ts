import { useCallback } from "react";

import { useCatalogueCache, type CatalogueEntry } from "@/lib/catalogue-queries";
import type { FieldErrorsState, NameMatch } from "@/lib/field-errors";

import { restoreEntry, type CatalogueEntryKind } from "../api/catalogue-entry-api";

/** Restores an archived entry (or a book entry removed for the campaign) into the cached lists. */
export function useCatalogueRestore<K extends CatalogueEntryKind>(kind: K, campaignId: number) {
  const catalogueCache = useCatalogueCache();
  return useCallback(
    async (entry: { id: number; campaign_id?: number | null }) => {
      const restored = await restoreEntry<CatalogueEntry<K>>(kind, entry, campaignId);
      catalogueCache.write(kind, campaignId, restored);
      return restored;
    },
    [campaignId, catalogueCache, kind]
  );
}

type UseNameTakenMatchesOptions = {
  kind: CatalogueEntryKind;
  campaignId: number;
  fieldErrors: FieldErrorsState;
  /** Opens a match's edit form (a page's own form); dialogs leave it out. */
  onEditMatch?: (match: NameMatch) => void;
};

/**
 * What a form offers under a taken name (CAT-TWEAK-02): every entry it collided with, "Edit this
 * instead" on one in the catalogue (where the form can edit), and Restore on an archived one.
 */
export function useNameTakenMatches({
  kind,
  campaignId,
  fieldErrors,
  onEditMatch,
}: UseNameTakenMatchesOptions) {
  const restore = useCatalogueRestore(kind, campaignId);
  const { markRestored } = fieldErrors;
  return {
    matches: fieldErrors.matches,
    onEdit: onEditMatch,
    onRestore: async (match: NameMatch) => {
      await restore({ id: match.id, campaign_id: match.source === "book" ? null : campaignId });
      markRestored(match.id);
    },
  };
}

export type NameTakenState = ReturnType<typeof useNameTakenMatches>;
