import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { Button } from "@components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@components/card";
import { CardBackground } from "@components/card-background";
import { Input } from "@components/input";

import AuthShell from "../components/AuthShell";
import { confirmPasswordReset } from "../api/auth-api";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const uid = searchParams.get("uid") || "";
  const token = searchParams.get("token") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const isLinkValid = useMemo(() => uid.length > 0 && token.length > 0, [uid, token]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("idle");
    setMessage("");

    if (!isLinkValid) {
      setStatus("error");
      setMessage("This reset link is missing required information.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setStatus("error");
      setMessage("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await confirmPasswordReset({
        uid,
        token,
        new_password: newPassword,
      });
      setStatus("success");
      setMessage(response.detail);
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unable to reset password.";
      setStatus("error");
      setMessage(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell>
      <CardBackground
        as={Card}
        className="auth-card flex h-full w-full flex-col border border-emerald-500/40 shadow-[0_30px_70px_rgba(5,20,24,0.6),0_0_25px_rgba(0,255,153,0.45),inset_0_0_35px_rgba(0,255,153,0.25)] backdrop-blur-sm"
      >
        <CardHeader className="space-y-3">
          <CardTitle className="text-lg">Set a new password</CardTitle>
          <p className="text-sm text-muted-foreground">
            Create a new secret for your account. This link expires after a short time.
          </p>
        </CardHeader>
        <CardContent className="flex-1">
          <form className="space-y-5" onSubmit={handleSubmit}>
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
            {message ? (
              <p className={status === "error" ? "text-sm text-destructive" : "text-sm"}>
                {message}
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
        </CardContent>
      </CardBackground>
    </AuthShell>
  );
}
