import { useCallback, useState } from "react";

import { useLedgerEntry } from "../../api/economy-queries";

import type { WarbandTrade, WarbandTradePayload } from "../../types/warband-types";

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message || "Unable to create trade" : "Unable to create trade";

/** The action whose gold is signed as typed and whose description is its reason (decision 5). */
export const ADJUSTMENT = "Adjustment";

/**
 * The Treasury's manual entry form: its fields, its checks and the ledger entry it sends. The
 * entry lands on top of the cached ledger (`useLedgerEntry`); the form closes once it is saved.
 * An Adjustment adds (+) or takes away (-) gold with a reason, and can name the row it corrects.
 */
export function useTreasuryEntryForm(warbandId: number) {
  const ledgerEntry = useLedgerEntry(warbandId);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formAction, setFormAction] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [correcting, setCorrecting] = useState<WarbandTrade | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const isAdjustment = formAction === ADJUSTMENT;

  const resetForm = useCallback(() => {
    setFormAction("");
    setFormDescription("");
    setFormPrice("");
    setFormNotes("");
    setCorrecting(null);
    setSubmitError("");
  }, []);

  const handleOpenForm = useCallback(() => {
    resetForm();
    setIsFormOpen(true);
  }, [resetForm]);

  /** An Adjustment that corrects `row` (decision 5): no row's amount is ever changed. */
  const startCorrection = useCallback(
    (row: WarbandTrade) => {
      resetForm();
      setFormAction(ADJUSTMENT);
      setCorrecting(row);
      setIsFormOpen(true);
    },
    [resetForm]
  );

  const handleCloseForm = useCallback(() => {
    setIsFormOpen(false);
    resetForm();
  }, [resetForm]);

  const { mutateAsync: createEntry } = ledgerEntry;
  const handleSubmit = useCallback(async () => {
    const trimmedAction = formAction.trim();
    const trimmedDescription = formDescription.trim();
    const price = parseInt(formPrice, 10) || 0;
    if (!trimmedAction) {
      setSubmitError("Action is required.");
      return;
    }
    if (!trimmedDescription) {
      setSubmitError(isAdjustment ? "A reason is required." : "Description is required.");
      return;
    }
    if (isAdjustment && price === 0) {
      setSubmitError("Enter the gold this adjustment adds or takes away.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");
    const payload: WarbandTradePayload = {
      action: trimmedAction,
      description: trimmedDescription,
      price,
      notes: formNotes.trim(),
      ...(isAdjustment && correcting ? { corrects_id: correcting.id } : {}),
    };
    try {
      await createEntry(payload);
      handleCloseForm();
    } catch (error) {
      setSubmitError(messageOf(error));
    } finally {
      setIsSubmitting(false);
    }
  }, [
    correcting,
    createEntry,
    formAction,
    formDescription,
    formNotes,
    formPrice,
    handleCloseForm,
    isAdjustment,
  ]);

  return {
    isFormOpen,
    handleOpenForm,
    handleCloseForm,
    startCorrection,
    formAction,
    setFormAction,
    isAdjustment,
    formDescription,
    setFormDescription,
    formPrice,
    setFormPrice,
    formNotes,
    setFormNotes,
    /** The row the Adjustment corrects, and how to stop linking it. */
    correcting: isAdjustment ? correcting : null,
    clearCorrection: () => setCorrecting(null),
    isSubmitting,
    submitError,
    handleSubmit,
  };
}

export type TreasuryEntryForm = ReturnType<typeof useTreasuryEntryForm>;
