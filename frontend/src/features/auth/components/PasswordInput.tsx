import type { ComponentPropsWithoutRef } from "react";
import { useState } from "react";

// components
import { Input } from "@components/input";
import { Eye, EyeOff } from "lucide-react";

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
