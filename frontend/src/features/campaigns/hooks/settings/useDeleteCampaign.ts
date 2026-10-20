import { useState } from "react";

// api
import { deleteCampaign } from "../../api/campaigns-api";

// other
import { getErrorMessage } from "@/lib/get-error-message";

/** The delete card (`capabilities.delete`, the owner): type "delete", then the DELETE. */
export function useDeleteCampaign(campaignId: number, onDeleted: () => void) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteValue, setDeleteValue] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteCampaign = async () => {
    setIsDeleting(true);
    setDeleteError("");
    try {
      await deleteCampaign(campaignId);
      onDeleted();
    } catch (errorResponse) {
      setDeleteError(getErrorMessage(errorResponse, "Unable to close campaign"));
    } finally {
      setIsDeleting(false);
    }
  };

  const resetDeleteState = () => {
    setDeleteValue("");
    setDeleteError("");
  };

  return {
    deleteOpen,
    setDeleteOpen,
    deleteValue,
    setDeleteValue,
    deleteError,
    isDeleting,
    isDeleteReady: deleteValue.trim().toLowerCase() === "delete",
    handleDeleteCampaign,
    resetDeleteState,
  };
}
