import type { ReactNode } from "react";

// components
import { Input } from "@components/input";

type AuthFieldProps = {
  label: string;
  /** The field's input, named by the label around it. */
  children: ReactNode;
};

/**
 * One field of the auth forms: a caption over its input. A hint or a per-field error belongs
 * after the label, not inside it, or it becomes part of the input's name.
 */
export function AuthField({ label, children }: AuthFieldProps) {
  return (
    <label className="mx-auto block w-full max-w-[320px] space-y-2 text-sm">
      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

type EmailFieldProps = {
  value: string;
  onChange: (value: string) => void;
};

export function EmailField({ value, onChange }: EmailFieldProps) {
  return (
    <AuthField label="Email">
      <Input
        type="email"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="name@wyrdstone.dev"
        autoComplete="email"
        required
        className="h-10 max-w-[320px]"
      />
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
