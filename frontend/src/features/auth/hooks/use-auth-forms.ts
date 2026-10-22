import type { FormEvent } from "react";
import { useState } from "react";

// api
import { requestPasswordReset } from "../api/auth-api";

// hooks
import { useAuth } from "./use-auth";

// utils
import { getErrorMessage } from "@/lib/get-error-message";

/** Where a form puts its refusal or notice: the sign-in card's one line under the form. */
type ShowMessage = (message: string) => void;

/** A form's typed values, kept while the card switches modes. */
function useFormValues<T extends Record<string, string>>(initial: T) {
  const [values, setValues] = useState(initial);
  const setField = (field: keyof T, value: string) =>
    setValues((previous) => ({ ...previous, [field]: value }));
  return { values, setField };
}

/** Sign-in: the email as typed (the server lowercases it) and the password. */
export function useLoginForm(showError: ShowMessage) {
  const { signIn, isSubmitting } = useAuth();
  const { values, setField } = useFormValues({ email: "", password: "" });

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    showError("");
    try {
      await signIn({ email: values.email, password: values.password });
    } catch (error) {
      showError(getErrorMessage(error, "Unable to sign in"));
    }
  };

  return { values, setField, submit, isSubmitting };
}

/** Sign-up: a display name (decision 2), the email and a password. */
export function useRegisterForm(showError: ShowMessage) {
  const { signUp, isSubmitting } = useAuth();
  const { values, setField } = useFormValues({ name: "", email: "", password: "" });

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    showError("");
    try {
      await signUp({ name: values.name, email: values.email, password: values.password });
    } catch (error) {
      showError(getErrorMessage(error, "Unable to sign in"));
    }
  };

  return { values, setField, submit, isSubmitting };
}

/** The inline forgot-password form: its own address, and the server's answer as a notice. */
export function useForgotForm(showError: ShowMessage, showNotice: ShowMessage) {
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    showError("");
    showNotice("");
    setIsSending(true);
    try {
      const response = await requestPasswordReset({ email });
      showNotice(response.detail);
    } catch (error) {
      showError(getErrorMessage(error, "Unable to send reset email"));
    } finally {
      setIsSending(false);
    }
  };

  return { email, setEmail, submit, isSending };
}

export type LoginFormState = ReturnType<typeof useLoginForm>;
export type RegisterFormState = ReturnType<typeof useRegisterForm>;
export type ForgotFormState = ReturnType<typeof useForgotForm>;
