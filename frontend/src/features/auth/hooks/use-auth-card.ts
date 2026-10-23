import { useEffect, useState } from "react";

// hooks
import { useForgotForm, useLoginForm, useRegisterForm } from "./use-auth-forms";

export type AuthMode = "login" | "register" | "forgot";

/**
 * The sign-in card's state: which form shows, each form's values (kept across a mode switch),
 * and the one refusal or notice line under the form, which a mode switch clears.
 */
export function useAuthCard() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const login = useLoginForm(setError);
  const register = useRegisterForm(setError);
  const forgot = useForgotForm(setError, setNotice);

  useEffect(() => {
    setError("");
    setNotice("");
  }, [mode]);

  return { mode, setMode, error, notice, login, register, forgot };
}
