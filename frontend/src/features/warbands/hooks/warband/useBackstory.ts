import { useEffect, useState } from "react";

import { apiErrorCode, getErrorMessage } from "@/lib/get-error-message";
import { updateWarband } from "../../api/warbands-api";

import type { Warband } from "../../types/warband-types";

type UseBackstoryParams = {
  warband: Warband;
  canEdit: boolean;
  onWarbandUpdated: (warband: Warband) => void;
};

export function useBackstory({ warband, canEdit, onWarbandUpdated }: UseBackstoryParams) {
  const [backstoryDraft, setBackstoryDraft] = useState(warband.backstory ?? "");
  const [isEditingBackstory, setIsEditingBackstory] = useState(false);
  const [isSavingBackstory, setIsSavingBackstory] = useState(false);
  const [backstoryError, setBackstoryError] = useState("");
  const [backstoryMessage, setBackstoryMessage] = useState("");

  useEffect(() => {
    if (isEditingBackstory) {
      return;
    }
    setBackstoryDraft(warband.backstory ?? "");
  }, [warband, isEditingBackstory]);

  const handleSaveBackstory = async () => {
    if (!canEdit) {
      return;
    }

    setIsSavingBackstory(true);
    setBackstoryError("");
    setBackstoryMessage("");

    try {
      const updated = await updateWarband(warband.id, {
        backstory: backstoryDraft.trim() ? backstoryDraft.trim() : null,
      });
      onWarbandUpdated(updated);
      setIsEditingBackstory(false);
      setBackstoryMessage("Backstory updated.");
    } catch (errorResponse) {
      // Decision 13: only the owner may change it (the capability may be out of date).
      if (apiErrorCode(errorResponse) === "backstory_owner_only") {
        setBackstoryError("Only the warband's owner can change its backstory.");
      } else if (errorResponse instanceof Error) {
        setBackstoryError(getErrorMessage(errorResponse, "Unable to update backstory"));
      } else {
        setBackstoryError("Unable to update backstory");
      }
    } finally {
      setIsSavingBackstory(false);
    }
  };

  const startEditing = () => {
    setIsEditingBackstory(true);
    setBackstoryMessage("");
  };

  const cancelEditing = () => {
    setIsEditingBackstory(false);
    setBackstoryDraft(warband.backstory ?? "");
    setBackstoryError("");
    setBackstoryMessage("");
  };

  return {
    backstoryDraft,
    setBackstoryDraft,
    isEditingBackstory,
    isSavingBackstory,
    backstoryError,
    backstoryMessage,
    handleSaveBackstory,
    startEditing,
    cancelEditing,
  };
}
