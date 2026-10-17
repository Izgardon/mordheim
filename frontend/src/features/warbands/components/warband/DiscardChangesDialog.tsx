import { ConfirmDialog } from "@/components/ui/confirm-dialog";

import type { DiscardDialogState } from "../../hooks/warband/useDiscardGuard";

/** "Discard your unsaved changes?" for every roster section and the tab switch (decision 2). */
export default function DiscardChangesDialog({
  open,
  message,
  onDiscard,
  onKeepEditing,
}: DiscardDialogState) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onKeepEditing();
      }}
      description={message}
      confirmText="Discard changes"
      cancelText="Keep editing"
      onConfirm={onDiscard}
    />
  );
}
