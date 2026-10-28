import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

// api
import { deleteAccount, fetchDeletionPreview } from "../api/auth-api";

// hooks
import { useAuth } from "./use-auth";

// utils
import { useFieldErrors } from "@/lib/field-errors";
import { apiErrorCode } from "@/lib/get-error-message";
import { queryKeys } from "@/lib/query-keys";

const PASSWORD_FIELD = ["current_password"] as const;

/**
 * Deleting your account (AUTH-NEW-05): the dialog reads what deleting does each time it opens,
 * then the current password confirms it. Done, this device signs out like Log out, with a toast.
 */
export function useAccountDeletion() {
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");
  const fieldErrors = useFieldErrors(PASSWORD_FIELD);
  const preview = useQuery({
    queryKey: queryKeys.account.deletionPreview(),
    queryFn: fetchDeletionPreview,
    enabled: open,
    staleTime: 0,
    retry: false,
  });

  const reset = () => {
    setPassword("");
    setError("");
    fieldErrors.clear();
  };

  const openDialog = () => {
    reset();
    setOpen(true);
  };

  const closeDialog = () => {
    setOpen(false);
    reset();
  };

  const confirm = async () => {
    setIsDeleting(true);
    setError("");
    fieldErrors.clear();
    try {
      await deleteAccount({ current_password: password });
      setOpen(false);
      signOut();
      toast("Your account is deleted.", {
        description: "Your warbands stay in their campaigns, shown as Former player.",
      });
    } catch (caught) {
      if (apiErrorCode(caught) === "hand_over_first") {
        void preview.refetch(); // a campaign gained a member since the dialog opened
      }
      setError(fieldErrors.take(caught, "Couldn't delete your account."));
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    open,
    openDialog,
    closeDialog,
    preview,
    password,
    setPassword,
    passwordError: fieldErrors.errors.current_password ?? "",
    error,
    isDeleting,
    confirm,
  };
}

export type AccountDeletionState = ReturnType<typeof useAccountDeletion>;
