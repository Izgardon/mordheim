import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { useAuth } from "../hooks/use-auth";

export default function AuthCard() {
  const navigate = useNavigate();
  const { token, isReady, isSubmitting, signIn, signUp } = useAuth();
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
        await signUp({ name, email, password });
      } else {
        await signIn({ email, password });
      }
      navigate("/campaigns");
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setError(errorResponse.message || "Unable to sign in");
      } else {
        setError("Unable to sign in");
      }
    }
  };

  return (
    <Card className="border border-white/70">
      <CardHeader>
        <div className="flex rounded-full bg-slate-100 p-1">
          <Button
            type="button"
            variant={isRegister ? "ghost" : "default"}
            size="sm"
            className="flex-1 rounded-full text-xs uppercase tracking-[0.2em]"
            onClick={() => setMode("login")}
          >
            Sign in
          </Button>
          <Button
            type="button"
            variant={isRegister ? "default" : "ghost"}
            size="sm"
            className="flex-1 rounded-full text-xs uppercase tracking-[0.2em]"
            onClick={() => setMode("register")}
          >
            Create
          </Button>
        </div>
        <CardTitle className="text-2xl">
          {isRegister ? "Create your account" : "Welcome back"}
        </CardTitle>
        <CardDescription>
          {isRegister
            ? "Set a login to start your next campaign."
            : "Enter your details to access the warroom."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          {isRegister ? (
            <label className="block space-y-2 text-sm">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Display name
              </span>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Valiant Captain"
                autoComplete="name"
              />
            </label>
          ) : null}
          <label className="block space-y-2 text-sm">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Email
            </span>
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@warband.dev"
              autoComplete="email"
              required
            />
          </label>
          <label className="block space-y-2 text-sm">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Password
            </span>
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Use something strong"
              autoComplete={isRegister ? "new-password" : "current-password"}
              required
            />
          </label>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button className="w-full" type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? "Working..."
              : isRegister
              ? "Create account"
              : "Sign in"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
