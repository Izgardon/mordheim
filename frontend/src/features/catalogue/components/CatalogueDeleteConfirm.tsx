import { ConfirmDialog } from "@components/confirm-dialog";

import { deleteWording } from "@/lib/catalogue-delete";

import type { CatalogueDeleteConfirmState } from "../hooks/useCatalogueDelete";
import type { CatalogueEntryLike } from "../types/catalogue-entry";

type CatalogueDeleteConfirmProps = {
  confirm: CatalogueDeleteConfirmState;
  /** The entry, as the question names it (a book entry is removed, not deleted). */
  entry: CatalogueEntryLike;
  /** "item", "skill", "spell": the confirm button reads "Delete item". */
  noun: string;
  isDeleting: boolean;
  onConfirm: () => void;
};

/**
 * The confirm behind a catalogue entry's Delete: worded from what uses the entry (deleted,
 * archived with its counts, or removed from this campaign), and a refusal shows in it (BUG-148).
 */
export function CatalogueDeleteConfirm({
  confirm,
  entry,
  noun,
  isDeleting,
  onConfirm,
}: CatalogueDeleteConfirmProps) {
  const wording = deleteWording(entry, confirm.check, noun);
  const checkLine = confirm.checkError ? `Couldn't check what uses it: ${confirm.checkError}` : "";
  return (
    <ConfirmDialog
      open={confirm.isOpen}
      onOpenChange={confirm.onOpenChange}
      title={`Delete ${noun}`}
      error={confirm.error || checkLine}
      description={wording.message}
      confirmText={isDeleting ? "Deleting..." : wording.confirm}
      confirmDisabled={isDeleting || confirm.check.state === "checking"}
      isConfirming={isDeleting}
      onConfirm={onConfirm}
    />
  );
}
