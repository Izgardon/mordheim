import type { FormEvent } from "react";
import { useEffect, useState } from "react";

// routing
import { useNavigate } from "react-router-dom";

// components
import { Button } from "@components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/card";
import { Input } from "@components/input";

// hooks
import { useAuth } from "../hooks/use-auth";

export default function AuthCard() {
  const navigate = useNavigate();
  const { token, isReady, isSubmitting, signIn, signUp } = useAuth();
  const [mode, setMode] = useState("login");
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");

  const isRegister = mode === "register";

  useEffect(() => {
    if (isReady && token) {
      navigate("/campaigns", { replace: true });
    }
  }, [isReady, navigate, token]);

  useEffect(() => {
    setError("");
  }, [mode]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    try {
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

  return (
    <Card className="border border-border/60 bg-card/90 shadow-[0_25px_60px_rgba(5,20,24,0.5)] backdrop-blur-sm">
      <CardHeader className="space-y-3">
        <div className="flex rounded-full border border-border/60 bg-secondary/60 p-1 shadow-[0_10px_20px_rgba(5,20,24,0.35)]">
          <Button
            type="button"
            variant={isRegister ? "ghost" : "default"}
            size="sm"
            className="flex-1 rounded-full text-[0.6rem]"
            onClick={() => setMode("login")}
          >
            Sign in
          </Button>
          <Button
            type="button"
            variant={isRegister ? "default" : "ghost"}
            size="sm"
            className="flex-1 rounded-full text-[0.6rem]"
            onClick={() => setMode("register")}
          >
            Create Account
          </Button>
        </div>
        <CardTitle className="text-xl md:text-2xl">
          {isRegister ? "Claim your name" : "Return to Mordheim"}
        </CardTitle>
        <CardDescription>
          {isRegister
            ? "Choose a name to enter the City of the Damned."
            : "Enter your marks to step back into the ruins."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-5" onSubmit={handleSubmit}>
          {isRegister ? (
            <label className="block space-y-2 text-sm">
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
              />
            </label>
          ) : null}
          <label className="block space-y-2 text-sm">
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
            />
          </label>
          <label className="block space-y-2 text-sm">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Password
            </span>
            <Input
              type="password"
              value={isRegister ? registerForm.password : loginForm.password}
              onChange={(event) =>
                isRegister
                  ? setRegisterForm((prev) => ({ ...prev, password: event.target.value }))
                  : setLoginForm((prev) => ({ ...prev, password: event.target.value }))
              }
              placeholder="Keep it secret"
              autoComplete={isRegister ? "new-password" : "current-password"}
              required
            />
          </label>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button className="w-full" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Working..." : isRegister ? "Create account" : "Sign in"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}





