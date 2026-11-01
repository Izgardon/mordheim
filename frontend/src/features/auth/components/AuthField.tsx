import type { ReactNode } from "react";
import { useId } from "react";

// components
import { Input } from "@components/input";
import { cn } from "@/lib/utils";

/** The auth and account fields' input: 16 px text, so a phone doesn't zoom in on focus. */
export const AUTH_INPUT = "h-12 text-base md:h-12";

type AuthFieldProps = {
  label: string;
  /** Under the field, e.g. the password rules (AUTH-TWEAK-07). */
  hint?: string;
  /** The server's refusal of this field, under it rather than in the form's one line (BUG-171). */
  error?: string;
  className?: string;
  /**
   * The field's input, named by the label around it. As a function, it is given the ids of the
   * hint and the error, for its `aria-describedby`.
   */
  children: ReactNode | ((describedBy: string | undefined) => ReactNode);
};

/**
 * One field of the auth and account forms (design E): a caption over its input, then its hint and
 * its error. Those come after the label, not inside it, or they would become part of the input's
 * name.
 */
export function AuthField({ label, hint, error, className, children }: AuthFieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("flex w-full flex-col gap-1.5", className)}>
      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-faint">
          {label}
        </span>
        {typeof children === "function" ? children(describedBy) : children}
      </label>
      {hint ? (
        <p id={hintId} className="m-0 text-[13px] leading-snug text-text2">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="m-0 text-[13px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type EmailFieldProps = {
  value: string;
  onChange: (value: string) => void;
  error?: string;
};

export function EmailField({ value, onChange, error }: EmailFieldProps) {
  return (
    <AuthField label="Email" error={error}>
      {(describedBy) => (
        <Input
          type="email"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Email"
          autoComplete="email"
          required
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className={AUTH_INPUT}
        />
      )}
    </AuthField>
  );
}

type DisplayNameFieldProps = {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  className?: string;
};

/** The display name others see (decision 2): required, up to 40 characters. */
export function DisplayNameField({ value, onChange, error, className }: DisplayNameFieldProps) {
  return (
    <AuthField label="Display name" error={error} className={className}>
      {(describedBy) => (
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Display name"
          autoComplete="nickname"
          required
          maxLength={40}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className={AUTH_INPUT}
        />
      )}
    </AuthField>
  );
}

/** A form's refusal, announced (AUTH-UX-07), in a danger box; nothing when there is none. */
export function AuthFormError({ message }: { message: string }) {
  return message ? (
    <p
      role="alert"
      className="m-0 border border-danger-line bg-danger-bg px-3.5 py-3 text-sm text-danger"
    >
      {message}
    </p>
  ) : null;
}

/** A quiet text action in the auth column: Forgot password?, Back to sign in. */
export const AUTH_TEXT_ACTION =
  "self-start text-[13px] font-bold text-accent-text underline-offset-2 hover:text-accent-hi hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
