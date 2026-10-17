import { useCallback, useState } from "react";

import { useLedgerEntry } from "../../api/economy-queries";

import type { WarbandTradePayload } from "../../types/warband-types";

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message || "Unable to create trade" : "Unable to create trade";

/**
 * The Treasury's manual entry form: its fields, its checks and the ledger entry it sends. The
 * entry lands on top of the cached ledger (`useLedgerEntry`); the form closes once it is saved.
 */
export function useTreasuryEntryForm(warbandId: number) {
  const ledgerEntry = useLedgerEntry(warbandId);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formAction, setFormAction] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const resetForm = useCallback(() => {
    setFormAction("");
    setFormDescription("");
    setFormPrice("");
    setFormNotes("");
    setSubmitError("");
  }, []);

  const handleOpenForm = useCallback(() => {
    resetForm();
    setIsFormOpen(true);
  }, [resetForm]);

  const handleCloseForm = useCallback(() => {
    setIsFormOpen(false);
    resetForm();
  }, [resetForm]);

  const { mutateAsync: createEntry } = ledgerEntry;
  const handleSubmit = useCallback(async () => {
    const trimmedAction = formAction.trim();
    const trimmedDescription = formDescription.trim();
    if (!trimmedAction) {
      setSubmitError("Action is required.");
      return;
    }
    if (!trimmedDescription) {
      setSubmitError("Description is required.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");
    const payload: WarbandTradePayload = {
      action: trimmedAction,
      description: trimmedDescription,
      price: parseInt(formPrice, 10) || 0,
      notes: formNotes.trim(),
    };
    try {
      await createEntry(payload);
      handleCloseForm();
    } catch (error) {
      setSubmitError(messageOf(error));
    } finally {
      setIsSubmitting(false);
    }
  }, [createEntry, formAction, formDescription, formNotes, formPrice, handleCloseForm]);

  return {
    isFormOpen,
    handleOpenForm,
    handleCloseForm,
    formAction,
    setFormAction,
    formDescription,
    setFormDescription,
    formPrice,
    setFormPrice,
    formNotes,
    setFormNotes,
    isSubmitting,
    submitError,
    handleSubmit,
  };
}

export type TreasuryEntryForm = ReturnType<typeof useTreasuryEntryForm>;
