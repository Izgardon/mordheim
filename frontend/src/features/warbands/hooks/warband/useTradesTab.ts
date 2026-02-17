import { useCallback, useEffect, useState } from "react";

import { listWarbandTrades, createWarbandTrade } from "../../api/warbands-api";

import type { WarbandTrade, WarbandTradePayload } from "../../types/warband-types";

type UseTradesTabOptions = {
  warbandId: number;
  onTradeCreated?: (trade: WarbandTrade) => void;
};

export default function useTradesTab({ warbandId, onTradeCreated }: UseTradesTabOptions) {
  const [trades, setTrades] = useState<WarbandTrade[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formAction, setFormAction] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    let isActive = true;

    setIsLoading(true);
    setError("");
    listWarbandTrades(warbandId)
      .then((data) => {
        if (!isActive) {
          return;
        }
        setTrades(data);
      })
      .catch((errorResponse) => {
        if (!isActive) {
          return;
        }
        if (errorResponse instanceof Error) {
          setError(errorResponse.message || "Unable to load trades");
        } else {
          setError("Unable to load trades");
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [warbandId]);

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

  const handleSubmit = useCallback(async () => {
    const trimmedAction = formAction.trim();
    const trimmedDescription = formDescription.trim();
    const priceValue = parseInt(formPrice, 10) || 0;

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
      price: priceValue,
      notes: formNotes.trim(),
    };

    try {
      const newTrade = await createWarbandTrade(warbandId, payload);
      setTrades((prev) => [newTrade, ...prev]);
      onTradeCreated?.(newTrade);
      handleCloseForm();
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setSubmitError(errorResponse.message || "Unable to create trade");
      } else {
        setSubmitError("Unable to create trade");
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [formAction, formDescription, formPrice, formNotes, warbandId, onTradeCreated, handleCloseForm]);

  return {
    // trade list
    trades,
    isLoading,
    error,

    // form visibility
    isFormOpen,
    handleOpenForm,
    handleCloseForm,

    // form fields
    formAction,
    setFormAction,
    formDescription,
    setFormDescription,
    formPrice,
    setFormPrice,
    formNotes,
    setFormNotes,

    // form submission
    isSubmitting,
    submitError,
    handleSubmit,
    resetForm,
  };
}
