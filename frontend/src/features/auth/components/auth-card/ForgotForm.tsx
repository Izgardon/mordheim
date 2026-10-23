// components
import { Button } from "@components/button";
import { AuthFormError, EmailField } from "../AuthField";

// types
import type { ForgotFormState } from "../../hooks/use-auth-forms";

type ForgotFormProps = {
  form: ForgotFormState;
  error: string;
  notice: string;
  onBack: () => void;
};

/** The one forgot-password flow, inside the sign-in card (decision 6). */
export function ForgotForm({ form, error, notice, onBack }: ForgotFormProps) {
  return (
    <form className="space-y-5" onSubmit={form.submit}>
      <EmailField value={form.email} onChange={form.setEmail} />
      {notice ? <p className="text-sm">{notice}</p> : null}
      <AuthFormError message={error} />
      <div className="flex flex-col items-center gap-3">
        <Button size="sm" type="submit" disabled={form.isSending}>
          {form.isSending ? "Sending..." : "Send reset link"}
        </Button>
        <button
          type="button"
          className="text-xs uppercase tracking-[0.2em] text-muted-foreground"
          onClick={onBack}
        >
          Back to sign in
        </button>
      </div>
    </form>
  );
}
