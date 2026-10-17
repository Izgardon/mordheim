import { useCallback, useState } from "react";

/** Asks before running `discard` when there are unsaved changes; runs it at once otherwise. */
export type ConfirmDiscard = (options: {
  isDirty: boolean;
  message: string;
  discard: () => void;
}) => void;

type PendingDiscard = { message: string; discard: () => void };

/**
 * Decision 2: Cancel and leaving the Warband tab with unsaved changes ask before discarding.
 * One guard (and one dialog, `DiscardChangesDialog`) serves every section of the page.
 */
export function useDiscardGuard() {
  const [pending, setPending] = useState<PendingDiscard | null>(null);

  const confirmDiscard = useCallback<ConfirmDiscard>(({ isDirty, message, discard }) => {
    if (!isDirty) {
      discard();
      return;
    }
    setPending({ message, discard });
  }, []);

  return {
    confirmDiscard,
    dialog: {
      open: pending !== null,
      message: pending?.message ?? "",
      onDiscard: () => {
        pending?.discard();
        setPending(null);
      },
      onKeepEditing: () => setPending(null),
    },
  };
}

export type DiscardDialogState = ReturnType<typeof useDiscardGuard>["dialog"];
