import { useState } from "react";

import { useCatalogueCache, type CatalogueEntry } from "@/lib/catalogue-queries";
import { getRefusalMessage } from "@/lib/get-error-message";

import { revertEntry, type CatalogueEntryKind } from "../api/catalogue-entry-api";
import type { CatalogueEntryLike } from "../types/catalogue-entry";

type UseCatalogueRevertOptions<K extends CatalogueEntryKind> = {
  kind: K;
  campaignId: number;
  /** The entry the form edits; Revert applies to a campaign's version only. */
  entry: (CatalogueEntryLike & CatalogueEntry<K>) | null;
  /** After a Revert, the book entry (or a rule's clone) already in the version's place. */
  onReverted?: (entry: CatalogueEntry<K>) => void;
};

/**
 * Revert to the book (CAT-TWEAK-01): the confirm's state and the request. The answer takes the
 * version's place in the cached list; a refusal stays in the confirm, which stays open.
 */
export function useCatalogueRevert<K extends CatalogueEntryKind>({
  kind,
  campaignId,
  entry,
  onReverted,
}: UseCatalogueRevertOptions<K>) {
  const catalogueCache = useCatalogueCache();
  const [isOpen, setIsOpen] = useState(false);
  const [isReverting, setIsReverting] = useState(false);
  const [error, setError] = useState("");

  const onOpenChange = (open: boolean) => {
    setIsOpen(open);
    setError("");
  };

  const revert = async (after?: () => void) => {
    if (!entry) {
      return;
    }
    setIsReverting(true);
    setError("");
    try {
      const book = await revertEntry<CatalogueEntry<K>>(kind, entry, campaignId);
      catalogueCache.write(kind, campaignId, book, entry.id);
      // The campaign's copies went back to the book entry.
      void catalogueCache.heldCopiesChanged(kind, campaignId);
      setIsOpen(false);
      onReverted?.(book);
      after?.();
    } catch (caught) {
      setError(getRefusalMessage(caught, "Unable to revert"));
    } finally {
      setIsReverting(false);
    }
  };

  return {
    kind,
    campaignId,
    isOpen,
    isReverting,
    error,
    onOpenChange,
    open: () => onOpenChange(true),
    revert,
  };
}

export type CatalogueRevertState = ReturnType<typeof useCatalogueRevert>;
