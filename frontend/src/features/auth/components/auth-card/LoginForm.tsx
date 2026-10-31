// components
import { Button } from "@components/button";
import { AUTH_TEXT_ACTION, AuthField, AuthFormError, EmailField } from "../AuthField";
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
    <form className="flex flex-col gap-5" onSubmit={form.submit}>
      <EmailField value={form.values.email} onChange={(email) => form.setField("email", email)} />
      <div className="flex flex-col gap-2.5">
        <AuthField label="Password">
          <PasswordInput
            value={form.values.password}
            onChange={(event) => form.setField("password", event.target.value)}
            placeholder="Keep it secret"
            autoComplete="current-password"
            required
          />
        </AuthField>
        <button type="button" className={AUTH_TEXT_ACTION} onClick={onForgot}>
          Forgot password?
        </button>
      </div>
      <AuthFormError message={error} />
      <Button type="submit" className="h-12 w-full text-[15px]" disabled={form.isSubmitting}>
        {form.isSubmitting ? "Working..." : "Sign in"}
      </Button>
    </form>
  );
}
