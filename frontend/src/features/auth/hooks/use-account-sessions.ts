import type { FormEvent } from "react";
import { useState } from "react";
import { toast } from "sonner";

// api
import { changePassword, signOutOtherSessions } from "../api/auth-api";

// utils
import { useFieldErrors } from "@/lib/field-errors";
import { getErrorMessage } from "@/lib/get-error-message";
import { session } from "@/lib/session";

const PASSWORD_FIELDS = ["current_password", "new_password"] as const;

/**
 * Changing your password (AUTH-NEW-03): the current one and a new one. The server signs out every
 * other device and answers a fresh pair for this one, which the session keeps, so this device
 * (and its other tabs) stays signed in. Each refusal shows under its field.
 */
export function usePasswordChange() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const fieldErrors = useFieldErrors(PASSWORD_FIELDS);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    fieldErrors.clear();
    setError("");
    setIsSaving(true);
    try {
      const answer = await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      session.setTokens(answer);
      setCurrentPassword("");
      setNewPassword("");
      toast("Password changed.", { description: "Your other devices are signed out." });
    } catch (caught) {
      setError(fieldErrors.take(caught, "Couldn't change your password."));
    } finally {
      setIsSaving(false);
    }
  };

  return {
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    submit,
    isSaving,
    error,
    errors: fieldErrors.errors,
  };
}

/**
 * Sign out everywhere else (AUTH-NEW-04): every other device's next request lands on sign-in
 * with "Your session ended"; this one keeps the fresh pair the server answers.
 */
export function useSignOutOthers() {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState("");

  const signOutOthers = async () => {
    setError("");
    setIsSigningOut(true);
    try {
      session.setTokens(await signOutOtherSessions());
      toast("Signed out everywhere else.", { description: "This device stays signed in." });
    } catch (caught) {
      setError(getErrorMessage(caught, "Couldn't sign out your other devices."));
    } finally {
      setIsSigningOut(false);
    }
  };

  return { signOutOthers, isSigningOut, error };
}
