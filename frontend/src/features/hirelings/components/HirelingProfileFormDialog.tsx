import { useEffect } from "react";

import { CatalogueFormDialog } from "@/features/catalogue/components/CatalogueFormDialog";

import { useHirelingProfileDetail } from "../hooks/useHirelingProfileDetail";
import { useHirelingProfileForm } from "../hooks/useHirelingProfileForm";
import HirelingProfileFormFields from "./form/HirelingProfileFormFields";

import type { NameMatch } from "@/lib/field-errors";
import type { HirelingCatalogueConfig } from "../hireling-catalogue-kinds";
import type { HirelingProfile, HirelingProfileDetail } from "../types/hireling-catalogue-types";

type Props = {
  config: HirelingCatalogueConfig;
  campaignId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The entry to edit (its detail is read, or taken from the cache); null adds one. */
  editingId: number | null;
  canDelete: boolean;
  onSaved?: (saved: HirelingProfileDetail, editedId: number | null) => void;
  onDeleted?: (entryId: number) => void;
  onReverted?: (book: HirelingProfile) => void;
  onEditMatch?: (match: NameMatch) => void;
};

/**
 * Add or Edit a hired sword or dramatis persona, in a dialog: the shared form, Delete (worded
 * from what uses it) or Revert to book for a campaign's version, Cancel and Save.
 */
export default function HirelingProfileFormDialog({
  config,
  campaignId,
  open,
  onOpenChange,
  editingId,
  canDelete,
  onSaved,
  onDeleted,
  onReverted,
  onEditMatch,
}: Props) {
  const detail = useHirelingProfileDetail(config.kind, campaignId, open ? editingId : null);
  const entry = editingId === null ? null : detail.entry;
  const form = useHirelingProfileForm({
    config,
    campaignId,
    entry,
    open,
    resetKey: `${open}-${editingId}`,
    onSaved: (saved) => onSaved?.(saved, editingId),
    onDeleted,
    onReverted,
    onEditMatch,
  });
  const { load } = form;

  // Opening fills the form: blank to add, or the edited entry once it has arrived.
  useEffect(() => {
    if (open) {
      load(entry);
    }
  }, [entry, load, open]);

  // Until the edited entry arrives there is nothing to save: Save waits with the fields.
  const isWaiting = editingId !== null && !entry;
  const shellForm = isWaiting ? { ...form, isSaving: true, save: async () => undefined } : form;
  return (
    <CatalogueFormDialog
      form={shellForm}
      dialog={{ open, setOpen: onOpenChange }}
      editing={entry}
      title={`${editingId === null ? "Add" : "Edit"} ${config.labels.noun}`}
      noun={config.labels.noun}
      trigger={null}
      defaultTrigger={null}
      submitLabel={editingId === null ? "Create" : "Save changes"}
      canDelete={canDelete}
      onReset={() => undefined}
    >
      {isWaiting ? (
        <p className="text-sm text-muted-foreground">
          {detail.error || `Loading ${config.labels.noun}...`}
        </p>
      ) : (
        <HirelingProfileFormFields form={form} open={open} />
      )}
    </CatalogueFormDialog>
  );
}
