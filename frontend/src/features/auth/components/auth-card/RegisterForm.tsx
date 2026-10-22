// components
import { Button } from "@components/button";
import { Input } from "@components/input";
import { AuthField, AuthFormError, EmailField } from "../AuthField";
import { PasswordInput } from "../PasswordInput";

// types
import type { RegisterFormState } from "../../hooks/use-auth-forms";

type RegisterFormProps = {
  form: RegisterFormState;
  error: string;
};

export function RegisterForm({ form, error }: RegisterFormProps) {
  return (
    <form className="space-y-5" onSubmit={form.submit}>
      <AuthField label="Display name">
        <Input
          value={form.values.name}
          onChange={(event) => form.setField("name", event.target.value)}
          placeholder="Gravewatch Captain"
          autoComplete="nickname"
          required
          maxLength={40}
          className="h-10 max-w-[320px]"
        />
      </AuthField>
      <EmailField value={form.values.email} onChange={(email) => form.setField("email", email)} />
      <AuthField label="Password">
        <PasswordInput
          value={form.values.password}
          onChange={(event) => form.setField("password", event.target.value)}
          placeholder="Keep it secret"
          autoComplete="new-password"
          required
        />
      </AuthField>
      <AuthFormError message={error} />
      <div className="flex justify-center">
        <Button size="sm" type="submit" disabled={form.isSubmitting}>
          {form.isSubmitting ? "Working..." : "Create account"}
        </Button>
      </div>
    </form>
  );
}
