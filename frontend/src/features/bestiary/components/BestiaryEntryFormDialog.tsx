import { useEffect } from "react";

import { CatalogueFormDialog } from "@/features/catalogue/components/CatalogueFormDialog";

import { useBestiaryEntryDetail } from "../hooks/useBestiaryEntryDetail";
import { useBestiaryEntryForm } from "../hooks/useBestiaryEntryForm";
import BestiaryEntryFormFields from "./form/BestiaryEntryFormFields";

import type { NameMatch } from "@/lib/field-errors";
import type { BeastKind } from "../bestiary-kinds";
import type { BestiaryEntry, BestiaryEntrySummary } from "../types/bestiary-types";

type Props = {
  campaignId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The beast to edit (its detail is read, or taken from the cache); null adds one. */
  editingId: number | null;
  /** A new beast's kind. */
  defaultKind?: BeastKind;
  canDelete: boolean;
  onSaved?: (saved: BestiaryEntry, editedId: number | null) => void;
  onDeleted?: (entryId: number) => void;
  onReverted?: (book: BestiaryEntrySummary) => void;
  onEditMatch?: (match: NameMatch) => void;
};

/**
 * Add or Edit a beast, in a dialog: the shared form, Delete (worded from what holds its item) or
 * Revert to book for a campaign's version, Cancel and Save.
 */
export default function BestiaryEntryFormDialog({
  campaignId,
  open,
  onOpenChange,
  editingId,
  defaultKind,
  canDelete,
  onSaved,
  onDeleted,
  onReverted,
  onEditMatch,
}: Props) {
  const detail = useBestiaryEntryDetail(campaignId, open ? editingId : null);
  const entry = editingId === null ? null : detail.entry;
  const form = useBestiaryEntryForm({
    campaignId,
    entry,
    defaultKind,
    open,
    resetKey: `${open}-${editingId}`,
    onSaved: (saved) => onSaved?.(saved, editingId),
    onDeleted,
    onReverted,
    onEditMatch,
  });
  const { load } = form;

  // Opening fills the form: blank to add (of the kind shown), or the edited beast once it arrives.
  useEffect(() => {
    if (open) {
      load(entry, defaultKind);
    }
  }, [defaultKind, entry, load, open]);

  // Until the edited beast arrives there is nothing to save: Save waits with the fields.
  const isWaiting = editingId !== null && !entry;
  const shellForm = isWaiting ? { ...form, isSaving: true, save: async () => undefined } : form;
  return (
    <CatalogueFormDialog
      form={shellForm}
      dialog={{ open, setOpen: onOpenChange }}
      editing={entry}
      title={`${editingId === null ? "Add" : "Edit"} bestiary entry`}
      noun="bestiary entry"
      trigger={null}
      defaultTrigger={null}
      submitLabel={editingId === null ? "Create" : "Save changes"}
      canDelete={canDelete}
      onReset={() => undefined}
    >
      {isWaiting ? (
        <p className="text-sm text-muted-foreground">
          {detail.error || "Loading bestiary entry..."}
        </p>
      ) : (
        <BestiaryEntryFormFields form={form} />
      )}
    </CatalogueFormDialog>
  );
}
