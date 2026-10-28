import type { ComponentPropsWithoutRef } from "react";
import { useState } from "react";

// components
import { Input } from "@components/input";
import { Eye, EyeOff } from "lucide-react";
import { AuthField } from "./AuthField";

type PasswordInputProps = Omit<ComponentPropsWithoutRef<typeof Input>, "type" | "className"> & {
  /** A show/hide toggle inside the field; hidden again whenever the field remounts. */
  revealable?: boolean;
};

export function PasswordInput({ revealable = true, ...props }: PasswordInputProps) {
  const [isRevealed, setIsRevealed] = useState(false);

  if (!revealable) {
    return <Input type="password" className="h-10 max-w-[320px]" {...props} />;
  }

  return (
    <div className="relative">
      <Input
        type={isRevealed ? "text" : "password"}
        className="h-10 max-w-[320px] pr-10"
        {...props}
      />
      <button
        type="button"
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
        onClick={() => setIsRevealed((previous) => !previous)}
        aria-label={isRevealed ? "Hide password" : "Show password"}
      >
        {isRevealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

type PasswordFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  /** The server's refusal of this field, under it (BUG-171). */
  error?: string;
  placeholder?: string;
  className?: string;
};

/** A labelled password field with the show/hide toggle and its own error. */
export function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  error,
  placeholder = "Keep it secret",
  className,
}: PasswordFieldProps) {
  return (
    <AuthField label={label} error={error} className={className}>
      {(describedBy) => (
        <PasswordInput
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
        />
      )}
    </AuthField>
  );
}
