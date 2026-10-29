import type { FormEvent } from "react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

// api
import { renameAccount } from "../api/auth-api";

// utils
import { useFieldErrors } from "@/lib/field-errors";
import { queryKeys } from "@/lib/query-keys";
import { session } from "@/lib/session";

// types
import type { AuthUser } from "../types/auth-types";

const SHOWN_FIELDS = ["name"] as const;

/**
 * Saving a display name (AUTH-NEW-02) through `PATCH auth/me/`: the signed-in user
 * takes the answer, and every campaign's cached lists read again, since the server renames the
 * user's chat messages and bulletin notes too. The server's refusal shows under the field.
 */
export function useDisplayNameForm(initialName: string, onSaved?: (user: AuthUser) => void) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(initialName);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const fieldErrors = useFieldErrors(SHOWN_FIELDS);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    fieldErrors.clear();
    setError("");
    setIsSaving(true);
    try {
      const user = await renameAccount(name);
      session.updateUser(user);
      void queryClient.invalidateQueries({ queryKey: queryKeys.campaign.every() });
      onSaved?.(user);
    } catch (caught) {
      setError(fieldErrors.take(caught, "Couldn't save your display name."));
    } finally {
      setIsSaving(false);
    }
  };

  return { name, setName, save, isSaving, error, nameError: fieldErrors.errors.name ?? "" };
}
