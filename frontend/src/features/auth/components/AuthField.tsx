import type { ReactNode } from "react";
import { useId } from "react";

// components
import { Input } from "@components/input";
import { cn } from "@/lib/utils";

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
 * One field of the auth and account forms: a caption over its input, then its hint and its
 * error. Those come after the label, not inside it, or they would become part of the input's name.
 */
export function AuthField({ label, hint, error, className, children }: AuthFieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("mx-auto w-full max-w-[320px] space-y-2 text-sm", className)}>
      <label className="block space-y-2">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {label}
        </span>
        {typeof children === "function" ? children(describedBy) : children}
      </label>
      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-destructive">
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
          placeholder="name@wyrdstone.dev"
          autoComplete="email"
          required
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className="h-10 max-w-[320px]"
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
          placeholder="Gravewatch Captain"
          autoComplete="nickname"
          required
          maxLength={40}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className="h-10 max-w-[320px]"
        />
      )}
    </AuthField>
  );
}

/** A form's refusal, announced (AUTH-UX-07); nothing when there is none. */
export function AuthFormError({ message }: { message: string }) {
  return message ? (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  ) : null;
}
