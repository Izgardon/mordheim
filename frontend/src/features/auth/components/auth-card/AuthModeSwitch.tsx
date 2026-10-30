// components
import { Button } from "@components/button";

// types
import type { AuthMode } from "../../hooks/use-auth-card";

type AuthModeSwitchProps = {
  mode: AuthMode;
  isMobile: boolean;
  onSelect: (mode: AuthMode) => void;
};

const MODES = [
  { mode: "login", label: "Sign in" },
  { mode: "register", label: "Create Account" },
] as const;

/** Sign in or Create Account; neither is pressed on the forgot-password form (AUTH-UX-07). */
export function AuthModeSwitch({ mode, isMobile, onSelect }: AuthModeSwitchProps) {
  const buttonClassName = isMobile
    ? "flex-1 px-3 text-xs leading-none py-2"
    : "min-w-[110px] px-4 text-xs leading-none py-1";

  return (
    <div className={isMobile ? "flex w-full gap-2" : "mx-auto flex w-fit border border-border p-1"}>
      {MODES.map((option) => (
        <Button
          key={option.mode}
          type="button"
          variant={mode === option.mode ? "primary" : "secondary"}
          size="sm"
          className={buttonClassName}
          onClick={() => onSelect(option.mode)}
          aria-pressed={mode === option.mode}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
