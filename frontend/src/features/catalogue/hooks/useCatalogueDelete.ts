import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import type { UsageCheck } from "@/lib/catalogue-delete";
import { useCatalogueCache } from "@/lib/catalogue-queries";
import { getRefusalMessage } from "@/lib/get-error-message";
import { queryKeys } from "@/lib/query-keys";

import { deleteEntry, entryUsage, type CatalogueEntryKind } from "../api/catalogue-entry-api";
import type { CatalogueEntryLike } from "../types/catalogue-entry";

type UseCatalogueDeleteOptions = {
  kind: CatalogueEntryKind;
  campaignId: number;
  /** The entry the form edits (none when adding). */
  entry: CatalogueEntryLike | null;
  /** "item": the fallback line reads "Unable to delete item". */
  noun: string;
  /** After the delete, the entry already gone from the cached lists. */
  onDeleted?: (entryId: number) => void;
};

/**
 * A catalogue entry's Delete (decision 5, CAT-TWEAK-04, CAT-NEW-05): opening the confirm asks
 * \`usage/\` first, so it can say what will happen (deleted, archived with its counts, or removed
 * from this campaign); the DELETE then leaves every cached list of the kind. A refusal (409
 * \`use_revert\`, 403 \`house_rule_item\`) stays in the confirm, which stays open (BUG-148).
 */
export function useCatalogueDelete({
  kind,
  campaignId,
  entry,
  noun,
  onDeleted,
}: UseCatalogueDeleteOptions) {
  const catalogueCache = useCatalogueCache();
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const usage = useQuery({
    queryKey: queryKeys.campaign.catalogueUsage(campaignId, kind, entry?.id ?? 0),
    queryFn: () => entryUsage(kind, entry!, campaignId),
    enabled: isOpen && Boolean(entry),
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  const check: UsageCheck = usage.data
    ? { state: "ready", usage: usage.data }
    : usage.error
      ? { state: "failed" }
      : { state: "checking" };

  const onOpenChange = (open: boolean) => {
    setIsOpen(open);
    setError("");
  };

  const remove = async (after?: () => void) => {
    if (!entry) {
      return;
    }
    setIsDeleting(true);
    setError("");
    try {
      const outcome = await deleteEntry(kind, entry, campaignId);
      catalogueCache.remove(kind, campaignId, entry.id);
      if (outcome?.outcome === "archived") {
        toast.success(`${entry.name} archived; its copies stay.`);
      } else if (outcome?.outcome === "removed") {
        toast.success(`${entry.name} removed from this campaign.`);
      }
      setIsOpen(false);
      onDeleted?.(entry.id);
      after?.();
    } catch (caught) {
      setError(getRefusalMessage(caught, `Unable to delete ${noun}`));
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    deleteConfirm: {
      isOpen,
      error,
      onOpenChange,
      open: () => onOpenChange(true),
      close: () => onOpenChange(false),
      /** What the usage check says so far. */
      check,
      /** Why the usage check failed (the delete may go ahead anyway). */
      checkError: usage.error ? getRefusalMessage(usage.error, "please try again.") : "",
    },
    remove,
    isDeleting,
  };
}

export type CatalogueDeleteConfirmState = ReturnType<typeof useCatalogueDelete>["deleteConfirm"];
