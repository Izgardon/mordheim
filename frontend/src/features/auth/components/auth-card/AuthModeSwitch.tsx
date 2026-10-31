import { cn } from "@/lib/utils";

// types
import type { AuthMode } from "../../hooks/use-auth-card";

type AuthModeSwitchProps = {
  mode: AuthMode;
  onSelect: (mode: AuthMode) => void;
};

const MODES = [
  { mode: "login", label: "Sign in" },
  { mode: "register", label: "Create account" },
] as const;

/**
 * Sign in or Create account, as the design E tabs (an accent underline on the pressed one);
 * neither is pressed on the forgot-password form (AUTH-UX-07).
 */
export function AuthModeSwitch({ mode, onSelect }: AuthModeSwitchProps) {
  return (
    <div
      role="group"
      aria-label="Sign in or create an account"
      className="flex gap-7 border-b border-line"
    >
      {MODES.map((option) => {
        const pressed = mode === option.mode;
        return (
          <button
            key={option.mode}
            type="button"
            aria-pressed={pressed}
            onClick={() => onSelect(option.mode)}
            className={cn(
              "-mb-px min-h-11 border-b-2 pb-2.5 pt-1 text-[15px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              pressed
                ? "border-primary text-head"
                : "border-transparent text-faint hover:text-text2"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
