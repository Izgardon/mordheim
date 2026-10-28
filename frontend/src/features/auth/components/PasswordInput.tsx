import type { ComponentPropsWithoutRef } from "react";
import { useState } from "react";

// components
import { Input } from "@components/input";
import { Eye, EyeOff } from "lucide-react";
import { AuthField } from "./AuthField";

/** The server's password rules in a sentence, under every new password (AUTH-TWEAK-07). */
export const PASSWORD_HINT =
  "At least 8 characters. Not a common password, not all numbers, and not too like your name or email.";

type PasswordInputProps = Omit<ComponentPropsWithoutRef<typeof Input>, "type" | "className">;

/** A password with a show/hide toggle inside the field, hidden again whenever it remounts. */
export function PasswordInput(props: PasswordInputProps) {
  const [isRevealed, setIsRevealed] = useState(false);

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
  /** The rules under the field: for a new password, not for its confirmation (AUTH-TWEAK-07). */
  showRules?: boolean;
  /** The server's refusal of this field (BUG-171). */
  error?: string;
  placeholder?: string;
  className?: string;
};

/** A labelled password field with the toggle, the rules hint when asked, and its own error. */
export function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  showRules = false,
  error,
  placeholder = "Keep it secret",
  className,
}: PasswordFieldProps) {
  return (
    <AuthField
      label={label}
      hint={showRules ? PASSWORD_HINT : undefined}
      error={error}
      className={className}
    >
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
