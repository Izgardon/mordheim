import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { Button } from "@components/button";

import { getErrorMessage } from "@/lib/get-error-message";

import { AUTH_TEXT_ACTION, AuthFormError } from "../components/AuthField";
import AuthShell, { AuthHeading } from "../components/AuthShell";
import { PasswordField } from "../components/PasswordInput";
import { confirmPasswordReset } from "../api/auth-api";
import { useAuth } from "../hooks/use-auth";

const INCOMPLETE_LINK_MESSAGE =
  "This reset link is incomplete. Ask for a new one from the sign-in page.";

export default function ResetPassword() {
  const location = useLocation();
  const navigate = useNavigate();
  const { token: sessionToken, signOut } = useAuth();
  // The email's link carries uid and token in the fragment (#uid=…&token=…), which no server
  // log or Referer sees (SEC-12). Read once, then dropped from the address bar.
  const [{ uid, token }] = useState(() => {
    const params = new URLSearchParams(location.hash.slice(1));
    return { uid: params.get("uid") ?? "", token: params.get("token") ?? "" };
  });
  useEffect(() => {
    if (location.hash) {
      navigate({ pathname: location.pathname, search: location.search }, { replace: true });
    }
  }, [location.hash, location.pathname, location.search, navigate]);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isDone, setIsDone] = useState(false);

  const isLinkValid = uid.length > 0 && token.length > 0;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!isLinkValid) {
      setError(INCOMPLETE_LINK_MESSAGE);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      await confirmPasswordReset({ uid, token, new_password: newPassword });
      // The link is used up: the form goes, so it can't be sent again (AUTH-UX-05).
      setIsDone(true);
      // A reset ends every session on the server, this device's included: drop it here too.
      if (sessionToken) {
        signOut();
      }
    } catch (errorResponse) {
      setError(getErrorMessage(errorResponse, "Unable to reset password."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const form = (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
      <AuthFormError message={isLinkValid ? "" : INCOMPLETE_LINK_MESSAGE} />
      {/* The toggle on both, the rules under the new one (AUTH-TWEAK-07); the confirm field stays. */}
      <PasswordField
        label="New password"
        value={newPassword}
        onChange={setNewPassword}
        autoComplete="new-password"
        showRules
      />
      <PasswordField
        label="Confirm password"
        value={confirmPassword}
        onChange={setConfirmPassword}
        autoComplete="new-password"
      />
      <AuthFormError message={error} />
      <Button
        type="submit"
        className="h-12 w-full text-[15px]"
        disabled={isSubmitting || !isLinkValid}
      >
        {isSubmitting ? "Updating..." : "Reset password"}
      </Button>
      <Link to="/" className={AUTH_TEXT_ACTION}>
        Back to sign in
      </Link>
    </form>
  );

  return (
    <AuthShell>
      <AuthHeading
        kicker="Mordheim Chronicler"
        title={isDone ? "Password updated" : "Set a new password"}
      >
        {isDone ? (
          <p role="status" className="m-0 text-[15px] text-text2">
            Sign in with your new password.
          </p>
        ) : (
          <p className="m-0 text-[15px] text-text2">
            Choose a new password for your account. This link is valid for 1 hour.
          </p>
        )}
      </AuthHeading>
      {isDone ? (
        <Button asChild className="h-12 w-full text-[15px]">
          <Link to="/">Sign in</Link>
        </Button>
      ) : (
        form
      )}
    </AuthShell>
  );
}
