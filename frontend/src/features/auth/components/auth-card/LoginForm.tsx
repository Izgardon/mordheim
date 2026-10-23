// components
import { Button } from "@components/button";
import { AuthField, AuthFormError, EmailField } from "../AuthField";
import { PasswordInput } from "../PasswordInput";

// types
import type { LoginFormState } from "../../hooks/use-auth-forms";

type LoginFormProps = {
  form: LoginFormState;
  error: string;
  onForgot: () => void;
};

export function LoginForm({ form, error, onForgot }: LoginFormProps) {
  return (
    <form className="space-y-5" onSubmit={form.submit}>
      <EmailField value={form.values.email} onChange={(email) => form.setField("email", email)} />
      <AuthField label="Password">
        <PasswordInput
          value={form.values.password}
          onChange={(event) => form.setField("password", event.target.value)}
          placeholder="Keep it secret"
          autoComplete="current-password"
          required
        />
      </AuthField>
      <div className="mx-auto w-full max-w-[320px] text-right">
        <button
          type="button"
          className="text-xs uppercase tracking-[0.2em] text-muted-foreground"
          onClick={onForgot}
        >
          Forgot password?
        </button>
      </div>
      <AuthFormError message={error} />
      <div className="flex justify-center">
        <Button size="sm" type="submit" disabled={form.isSubmitting}>
          {form.isSubmitting ? "Working..." : "Sign in"}
        </Button>
      </div>
    </form>
  );
}
