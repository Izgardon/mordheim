import type { FormEvent } from "react";
import { useEffect, useState } from "react";

// routing
import { useNavigate } from "react-router-dom";

import "../styles/auth.css";

// components
import { Button } from "@components/button";
import { Card, CardContent, CardFooter, CardHeader } from "@components/card";
import { CardBackground } from "@components/card-background";
import { Input } from "@components/input";
import { Eye, EyeOff } from "lucide-react";

// hooks
import { requestPasswordReset } from "../api/auth-api";
import { useAuth } from "../hooks/use-auth";
import { useMediaQuery } from "@/lib/use-media-query";
import titleImage from "@/assets/background/title.webp";
export default function AuthCard() {
  const navigate = useNavigate();
  const { token, isReady, isSubmitting, signIn, signUp } = useAuth();
  const isMobile = useMediaQuery("(max-width: 960px)");
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({ name: "", email: "", password: "" });
  const [forgotEmail, setForgotEmail] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isForgotSubmitting, setIsForgotSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isRegister = mode === "register";
  const isForgot = mode === "forgot";

  useEffect(() => {
    if (isReady && token) {
      navigate("/campaigns", { replace: true });
    }
  }, [isReady, navigate, token]);

  useEffect(() => {
    setError("");
    setNotice("");
    setShowPassword(false);
  }, [mode]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    try {
      if (isForgot) {
        return;
      }
      if (isRegister) {
        await signUp({
          name: registerForm.name,
          email: registerForm.email,
          password: registerForm.password,
        });
      } else {
        await signIn({
          email: loginForm.email,
          password: loginForm.password,
        });
      }
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setError(errorResponse.message || "Unable to sign in");
      } else {
        setError("Unable to sign in");
      }
    }
  };

  const handleForgotSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setIsForgotSubmitting(true);

    try {
      const response = await requestPasswordReset({ email: forgotEmail });
      setNotice(response.detail);
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setError(errorResponse.message || "Unable to send reset email");
      } else {
        setError("Unable to send reset email");
      }
    } finally {
      setIsForgotSubmitting(false);
    }
  };

  const headerContent = (
    <CardHeader className={isMobile ? "space-y-3 px-4 pb-3 pt-4" : "space-y-4 pt-6"}>
      {!isMobile ? (
        <div className="flex flex-col items-center gap-3 text-center">
          <h1 className="mt-10 text-3xl font-semibold uppercase tracking-[0.32em] text-foreground">
            Mordheim Chronicler
          </h1>
          <p className="text-sm font-medium text-foreground/90">
            The comet fell. The city burned. Chronicle every shard, victory and death across your
            campaign.
          </p>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-sm font-semibold uppercase tracking-[0.3em] text-foreground">
            {isForgot ? "Reset" : isRegister ? "Create" : "Sign in"}
          </h1>
          <span className="text-[0.55rem] uppercase tracking-[0.4em] text-muted-foreground">
            Mordheim
          </span>
        </div>
      )}
      <div className={isMobile ? "flex w-full gap-2" : "mx-auto flex w-fit rounded-full p-1 shadow-[0_10px_20px_rgba(5,20,24,0.35)]"}>
        <Button
          type="button"
          variant={isRegister || isForgot ? "secondary" : "default"}
          size="sm"
          className={isMobile ? "flex-1 rounded-full px-3 text-[0.55rem] leading-none py-2" : "min-w-[110px] rounded-full px-4 text-[0.55rem] leading-none py-1"}
          onClick={() => setMode("login")}
        >
          Sign in
        </Button>
        <Button
          type="button"
          variant={isRegister ? "default" : "secondary"}
          size="sm"
          className={isMobile ? "flex-1 rounded-full px-3 text-[0.55rem] leading-none py-2" : "min-w-[110px] rounded-full px-4 text-[0.55rem] leading-none py-1"}
          onClick={() => setMode("register")}
        >
          Create Account
        </Button>
      </div>
    </CardHeader>
  );

  const content = (
    <CardContent className={isMobile ? "px-4 pb-4 pt-2" : "flex-1"}>
        {isForgot ? (
          <form className="space-y-5" onSubmit={handleForgotSubmit}>
            <label className="mx-auto block w-full max-w-[320px] space-y-2 text-sm">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Email
              </span>
              <Input
                type="email"
                value={forgotEmail}
                onChange={(event) => setForgotEmail(event.target.value)}
                placeholder="name@wyrdstone.dev"
                autoComplete="email"
                required
                className="h-10 max-w-[320px]"
              />
            </label>
            {notice ? <p className="text-sm">{notice}</p> : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="flex flex-col items-center gap-3">
              <Button size="sm" type="submit" disabled={isForgotSubmitting}>
                {isForgotSubmitting ? "Sending..." : "Send reset link"}
              </Button>
              <button
                type="button"
                className="text-xs uppercase tracking-[0.2em] text-muted-foreground"
                onClick={() => setMode("login")}
              >
                Back to sign in
              </button>
            </div>
          </form>
        ) : (
          <form className="space-y-5" onSubmit={handleSubmit}>
            {isRegister ? (
              <label className="mx-auto block w-full max-w-[320px] space-y-2 text-sm">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Alias
                </span>
                <Input
                  value={registerForm.name}
                  onChange={(event) =>
                    setRegisterForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  placeholder="Gravewatch Captain"
                  autoComplete="name"
                  className="h-10 max-w-[320px]"
                />
              </label>
            ) : null}
            <label className="mx-auto block w-full max-w-[320px] space-y-2 text-sm">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Email
              </span>
              <Input
                type="email"
                value={isRegister ? registerForm.email : loginForm.email}
                onChange={(event) =>
                  isRegister
                    ? setRegisterForm((prev) => ({ ...prev, email: event.target.value }))
                    : setLoginForm((prev) => ({ ...prev, email: event.target.value }))
                }
                placeholder="name@wyrdstone.dev"
                autoComplete="email"
                required
                className="h-10 max-w-[320px]"
              />
            </label>
            <label className="mx-auto block w-full max-w-[320px] space-y-2 text-sm">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Password
              </span>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={isRegister ? registerForm.password : loginForm.password}
                  onChange={(event) =>
                    isRegister
                      ? setRegisterForm((prev) => ({ ...prev, password: event.target.value }))
                      : setLoginForm((prev) => ({ ...prev, password: event.target.value }))
                  }
                  placeholder="Keep it secret"
                  autoComplete={isRegister ? "new-password" : "current-password"}
                  required
                  className="h-10 max-w-[320px] pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>
            {!isRegister ? (
              <div className="mx-auto w-full max-w-[320px] text-right">
                <button
                  type="button"
                  className="text-xs uppercase tracking-[0.2em] text-muted-foreground"
                  onClick={() => setMode("forgot")}
                >
                  Forgot password?
                </button>
              </div>
            ) : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="flex justify-center">
              <Button size="sm" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Working..." : isRegister ? "Create account" : "Sign in"}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
  );

  if (isMobile) {
    return (
      <Card className="auth-card w-full rounded-t-[32px] border border-[#3b2f25] bg-[#15100c]/95 shadow-[0_-12px_30px_rgba(0,0,0,0.5)] backdrop-blur">
        {headerContent}
        {content}
      </Card>
    );
  }

  return (
    <CardBackground
      as={Card}
      className="auth-card flex h-full w-full flex-col border border-emerald-500/40 shadow-[0_30px_70px_rgba(5,20,24,0.6),0_0_25px_rgba(0,255,153,0.45),inset_0_0_35px_rgba(0,255,153,0.25)] backdrop-blur-sm"
    >
      {headerContent}
      {content}
      <CardFooter className="mt-auto justify-center">
        <img
          src={titleImage}
          alt="Mordheim: City of the Damned"
          className="w-full max-w-[340px] drop-shadow-[0_6px_12px_rgba(0,0,0,0.6)]"
        />
      </CardFooter>
    </CardBackground>
  );
}
