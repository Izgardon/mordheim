import { ConfirmDialog } from "@components/confirm-dialog";

import type { CatalogueDeleteConfirmState } from "@/lib/catalogue-delete";

type CatalogueDeleteConfirmProps = {
  confirm: CatalogueDeleteConfirmState;
  /** The entry's name, as the question names it. */
  name: string;
  /** "item", "skill", "spell": the confirm button reads "Delete item". */
  noun: string;
  isDeleting: boolean;
  onConfirm: () => void;
};

/** The confirm behind a catalogue entry's Delete; a refusal shows in it (BUG-148). */
export function CatalogueDeleteConfirm({
  confirm,
  name,
  noun,
  isDeleting,
  onConfirm,
}: CatalogueDeleteConfirmProps) {
  return (
    <ConfirmDialog
      open={confirm.isOpen}
      onOpenChange={confirm.onOpenChange}
      error={confirm.error}
      description={
        <span>
          Delete <span className="font-semibold text-foreground">{name}</span>? This action cannot
          be undone.
        </span>
      }
      confirmText={isDeleting ? "Deleting..." : `Delete ${noun}`}
      confirmDisabled={isDeleting}
      isConfirming={isDeleting}
      onConfirm={onConfirm}
    />
  );
}
