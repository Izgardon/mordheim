import * as React from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

type CheckboxProps = Omit<React.ComponentProps<"input">, "type"> & {
  checked?: boolean;
};

/** A square tick box on the tokens: accent fill when ticked. */
const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, disabled, ...props }, ref) => {
    return (
      <span
        className={cn(
          "relative inline-flex h-5 w-5 shrink-0 items-center justify-center",
          disabled && "cursor-not-allowed opacity-50",
          className
        )}
      >
        <input
          type="checkbox"
          ref={ref}
          checked={checked}
          disabled={disabled}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          {...props}
        />
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none flex h-full w-full items-center justify-center border transition-colors",
            checked
              ? "border-primary bg-primary text-on-accent"
              : "border-strong bg-page text-transparent"
          )}
        >
          <Check className="h-3.5 w-3.5" />
        </span>
      </span>
    );
  }
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
