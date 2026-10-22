import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { Button } from "@components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@components/card";
import { CardBackground } from "@components/card-background";
import { Input } from "@components/input";

import { getErrorMessage } from "@/lib/get-error-message";

import AuthShell from "../components/AuthShell";
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
    <form className="space-y-5" onSubmit={handleSubmit}>
      {!isLinkValid ? (
        <p role="alert" className="text-sm text-destructive">
          {INCOMPLETE_LINK_MESSAGE}
        </p>
      ) : null}
      <label className="mx-auto block w-full max-w-[320px] space-y-2 text-sm">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          New password
        </span>
        <Input
          type="password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          placeholder="Keep it secret"
          autoComplete="new-password"
          required
          className="h-10 max-w-[320px]"
        />
      </label>
      <label className="mx-auto block w-full max-w-[320px] space-y-2 text-sm">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Confirm password
        </span>
        <Input
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Repeat it"
          autoComplete="new-password"
          required
          className="h-10 max-w-[320px]"
        />
      </label>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col items-center gap-3">
        <Button size="sm" type="submit" disabled={isSubmitting || !isLinkValid}>
          {isSubmitting ? "Updating..." : "Reset password"}
        </Button>
        <Link to="/" className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Back to sign in
        </Link>
      </div>
    </form>
  );

  return (
    <AuthShell>
      <CardBackground
        as={Card}
        className="auth-card flex h-full w-full flex-col border border-emerald-500/40 shadow-[0_30px_70px_rgba(5,20,24,0.6),0_0_25px_rgba(0,255,153,0.45),inset_0_0_35px_rgba(0,255,153,0.25)] backdrop-blur-sm"
      >
        <CardHeader className="space-y-3">
          <CardTitle className="text-lg">
            {isDone ? "Password updated" : "Set a new password"}
          </CardTitle>
          {isDone ? (
            <p role="status" className="text-sm text-muted-foreground">
              Sign in with your new password.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Create a new secret for your account. This link is valid for 1 hour.
            </p>
          )}
        </CardHeader>
        <CardContent className="flex-1">
          {isDone ? (
            <div className="flex justify-center">
              <Button asChild size="sm">
                <Link to="/">Sign in</Link>
              </Button>
            </div>
          ) : (
            form
          )}
        </CardContent>
      </CardBackground>
    </AuthShell>
  );
}
