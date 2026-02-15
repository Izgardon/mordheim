import type { FormEvent } from "react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "@components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@components/card";
import { CardBackground } from "@components/card-background";
import { Input } from "@components/input";

import AuthShell from "../components/AuthShell";
import { requestPasswordReset } from "../api/auth-api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus("idle");
    setMessage("");

    try {
      const response = await requestPasswordReset({ email });
      setStatus("success");
      setMessage(response.detail);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unable to send reset email.";
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
          <CardTitle className="text-lg">Recover your account</CardTitle>
          <p className="text-sm text-muted-foreground">
            Enter the email you used to sign up. If we find a match, we will send a reset link.
          </p>
        </CardHeader>
        <CardContent className="flex-1">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <label className="mx-auto block w-full max-w-[320px] space-y-2 text-sm">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Email
              </span>
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@wyrdstone.dev"
                autoComplete="email"
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
              <Button size="sm" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Sending..." : "Send reset link"}
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
