import { useState } from "react";

import { getRefusalMessage } from "./get-error-message";

/**
 * The confirm behind a catalogue entry's Delete (BUG-148): when the server refuses, the confirm
 * stays open and says why (the refusal's own `detail`), instead of writing it into the form the
 * modal covers. Reopening starts clean.
 */
export function useCatalogueDeleteConfirm(fallback: string) {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState("");

  const onOpenChange = (open: boolean) => {
    setIsOpen(open);
    setError("");
  };

  return {
    isOpen,
    error,
    onOpenChange,
    open: () => onOpenChange(true),
    close: () => onOpenChange(false),
    /** Before sending the DELETE: the last refusal no longer applies. */
    clearError: () => setError(""),
    /** What the DELETE rejected with; the confirm stays open and shows it. */
    refused: (caught: unknown) => setError(getRefusalMessage(caught, fallback)),
  };
}
