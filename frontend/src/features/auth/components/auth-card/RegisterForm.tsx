// components
import { Button } from "@components/button";
import { AuthFormError, DisplayNameField, EmailField } from "../AuthField";
import { PasswordField } from "../PasswordInput";

// types
import type { RegisterFormState } from "../../hooks/use-auth-forms";

type RegisterFormProps = {
  form: RegisterFormState;
  error: string;
};

/** Sign-up; a refusal of one field shows under it, the rest under the form (BUG-171). */
export function RegisterForm({ form, error }: RegisterFormProps) {
  return (
    <form className="space-y-5" onSubmit={form.submit}>
      <DisplayNameField
        value={form.values.name}
        onChange={(name) => form.setField("name", name)}
        error={form.errors.name}
      />
      <EmailField
        value={form.values.email}
        onChange={(email) => form.setField("email", email)}
        error={form.errors.email}
      />
      <PasswordField
        label="Password"
        value={form.values.password}
        onChange={(password) => form.setField("password", password)}
        autoComplete="new-password"
        error={form.errors.password}
      />
      <AuthFormError message={error} />
      <div className="flex justify-center">
        <Button size="sm" type="submit" disabled={form.isSubmitting}>
          {form.isSubmitting ? "Working..." : "Create account"}
        </Button>
      </div>
    </form>
  );
}
