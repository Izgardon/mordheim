import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { bookCampaign } from "@/features/catalogue/api/catalogue-entry-api";
import { useCatalogueDelete } from "@/features/catalogue/hooks/useCatalogueDelete";
import { useCatalogueRevert } from "@/features/catalogue/hooks/useCatalogueRevert";
import { useNameTakenMatches } from "@/features/catalogue/hooks/useNameTakenMatches";
import { useCatalogueCache } from "@/lib/catalogue-queries";
import { useFieldErrors, type NameMatch } from "@/lib/field-errors";
import { queryKeys } from "@/lib/query-keys";

import { createBestiaryEntry, updateBestiaryEntry } from "../api/bestiary-api";
import {
  bestiaryPayload,
  bestiaryValuesOf,
  type BestiaryEntryValues,
} from "../utils/bestiary-form";
import { useBestiaryLinks } from "./useBestiaryLinks";

import type { BeastKind } from "../bestiary-kinds";
import type { BestiaryEntry, BestiaryEntrySummary } from "../types/bestiary-types";

/** The fields a refusal can name that the form shows by their input. */
const SHOWN_FIELDS = ["name", "kind", "armour_save", "item_entries"];

type UseBestiaryEntryFormOptions = {
  campaignId: number;
  /** The beast being edited, with its links; null when adding one. */
  entry: BestiaryEntry | null;
  /** A new beast's kind (the Kind filter's, when one is chosen). */
  defaultKind?: BeastKind;
  /** The pickers read the campaign's lists only while the form is open. */
  open: boolean;
  /** Server field errors clear whenever this changes. */
  resetKey: unknown;
  /** After a save, its answer already in the cached lists (a book beast's first edit: the version). */
  onSaved: (saved: BestiaryEntry) => void;
  onDeleted?: (entryId: number) => void;
  /** After a Revert, the book beast already in the version's place. */
  onReverted?: (book: BestiaryEntrySummary) => void;
  /** Opens the form on a beast a taken name collided with ("Edit this instead"). */
  onEditMatch?: (match: NameMatch) => void;
};

/**
 * The bestiary's Add or Edit form (`use<Kind>Form`): the beast's kind, profile and links; the save
 * (a book beast's first edit makes the campaign's version, written in its place, and its Animal
 * item's copies move with it), Delete with its usage check, and Revert. A taken name keeps the
 * form open with its matches.
 */
export function useBestiaryEntryForm({
  campaignId,
  entry,
  defaultKind,
  open,
  resetKey,
  onSaved,
  onDeleted,
  onReverted,
  onEditMatch,
}: UseBestiaryEntryFormOptions) {
  const queryClient = useQueryClient();
  const catalogueCache = useCatalogueCache();
  const [values, setValues] = useState(() => bestiaryValuesOf(entry, defaultKind));
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const fieldErrors = useFieldErrors(SHOWN_FIELDS, resetKey);
  const links = useBestiaryLinks({ campaignId, open, specialType: "Animal" });
  const nameTaken = useNameTakenMatches({ kind: "bestiary", campaignId, fieldErrors, onEditMatch });
  const deletion = useCatalogueDelete({
    kind: "bestiary",
    campaignId,
    entry,
    noun: "bestiary entry",
    onDeleted,
  });
  /** A write's answer (the beast as its detail reads), cached: the panel shows it with no read. */
  const cacheDetail = (saved: BestiaryEntry) =>
    queryClient.setQueryData(
      queryKeys.campaign.catalogueEntry(campaignId, "bestiary", saved.id),
      saved
    );
  const revert = useCatalogueRevert({
    kind: "bestiary",
    campaignId,
    entry,
    onReverted: (book) => {
      cacheDetail(book as BestiaryEntry);
      onReverted?.(book);
    },
  });

  const save = async (after?: () => void) => {
    if (!values.name.trim()) {
      setFormError("A name is required.");
      return;
    }
    setIsSaving(true);
    setFormError("");
    const payload = bestiaryPayload(values, links.payload());
    try {
      const saved = entry
        ? await updateBestiaryEntry(entry.id, { ...payload, ...bookCampaign(entry, campaignId) })
        : await createBestiaryEntry({ ...payload, campaign_id: campaignId });
      catalogueCache.write("bestiary", campaignId, saved, entry?.id);
      if (entry) {
        // The copies of its item now point at the version, or show the edit: sheets read them again.
        void catalogueCache.heldCopiesChanged("bestiary", campaignId);
      }
      cacheDetail(saved);
      onSaved(saved);
      after?.();
    } catch (caught) {
      setFormError(fieldErrors.take(caught, "Unable to save bestiary entry"));
    } finally {
      setIsSaving(false);
    }
  };

  const { load: loadLinks } = links;
  const { clear: clearFieldErrors } = fieldErrors;
  /** Back to `next`'s values and links (a blank form of `kind` for null), with no message. */
  const load = useCallback(
    (next: BestiaryEntry | null, kind?: BeastKind) => {
      setValues(bestiaryValuesOf(next, kind));
      loadLinks(next);
      setFormError("");
      clearFieldErrors();
    },
    [clearFieldErrors, loadLinks]
  );

  return {
    campaignId,
    values,
    change: (patch: Partial<BestiaryEntryValues>) => setValues((prev) => ({ ...prev, ...patch })),
    links,
    fieldErrors: fieldErrors.errors,
    nameTaken,
    isSaving: isSaving || deletion.isDeleting,
    formError,
    deleteConfirm: deletion.deleteConfirm,
    remove: deletion.remove,
    revert,
    save,
    load,
  };
}

export type BestiaryEntryFormState = ReturnType<typeof useBestiaryEntryForm>;
