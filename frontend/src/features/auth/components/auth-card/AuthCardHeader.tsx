// components
import { CardHeader } from "@components/card";
import { AuthModeSwitch } from "./AuthModeSwitch";

// types
import type { AuthMode } from "../../hooks/use-auth-card";

type AuthCardHeaderProps = {
  mode: AuthMode;
  isMobile: boolean;
  onSelectMode: (mode: AuthMode) => void;
};

const MOBILE_MODE_LABELS: Record<AuthMode, string> = {
  login: "Sign in",
  register: "Create",
  forgot: "Reset",
};

export function AuthCardHeader({ mode, isMobile, onSelectMode }: AuthCardHeaderProps) {
  return (
    <CardHeader className={isMobile ? "space-y-3 px-4 pb-3 pt-4" : "space-y-4 pt-6"}>
      {!isMobile ? (
        <div className="flex flex-col items-center gap-3 text-center">
          <h1 className="mt-10 text-3xl font-semibold uppercase tracking-[0.32em] text-foreground">
            Mordheim Chronicler
          </h1>
          <p className="text-sm font-medium text-foreground/90">
            The comet fell. The city burned. Chronicle every shard, victory and death across your
            campaign.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <h1 className="text-xl font-semibold uppercase tracking-[0.25em] text-foreground">
              Mordheim Chronicler
            </h1>
            <span className="shrink-0 text-[0.55rem] uppercase tracking-[0.4em] text-muted-foreground">
              {MOBILE_MODE_LABELS[mode]}
            </span>
          </div>
          <p className="text-[0.65rem] text-muted-foreground">
            Track every shard, victory and death across your campaign.
          </p>
        </div>
      )}
      <AuthModeSwitch mode={mode} isMobile={isMobile} onSelect={onSelectMode} />
    </CardHeader>
  );
}
