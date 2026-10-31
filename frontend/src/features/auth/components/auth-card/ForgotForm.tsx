// components
import { Button } from "@components/button";
import { AUTH_TEXT_ACTION, AuthFormError, EmailField } from "../AuthField";

// types
import type { ForgotFormState } from "../../hooks/use-auth-forms";

type ForgotFormProps = {
  form: ForgotFormState;
  error: string;
  notice: string;
  onBack: () => void;
};

/** The one forgot-password flow, inside the sign-in column (decision 6). */
export function ForgotForm({ form, error, notice, onBack }: ForgotFormProps) {
  return (
    <form className="flex flex-col gap-5" onSubmit={form.submit}>
      <div className="flex flex-col gap-1">
        <h2 className="m-0 font-display text-xl font-semibold leading-tight text-head">
          Forgot your password?
        </h2>
        <p className="m-0 text-sm text-text2">
          Give the email you signed up with, and we&apos;ll send a link to set a new one.
        </p>
      </div>
      <EmailField value={form.email} onChange={form.setEmail} />
      {notice ? (
        <p
          role="status"
          className="m-0 border border-good-line bg-good-bg px-3.5 py-3 text-sm text-good"
        >
          {notice}
        </p>
      ) : null}
      <AuthFormError message={error} />
      <Button type="submit" className="h-12 w-full text-[15px]" disabled={form.isSending}>
        {form.isSending ? "Sending..." : "Send reset link"}
      </Button>
      <button type="button" className={AUTH_TEXT_ACTION} onClick={onBack}>
        Back to sign in
      </button>
    </form>
  );
}
