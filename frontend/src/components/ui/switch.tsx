import * as React from "react";

import { cn } from "@/lib/utils";

export type SwitchProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "onChange" | "role" | "aria-checked"
> & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Shown beside the track, inside the control; without it give the switch an `aria-label`. */
  children?: React.ReactNode;
  /** "pill" (the default) boxes a labelled switch; "plain" is the thin track and its text only. */
  look?: "pill" | "plain";
};

/**
 * An on/off switch with a square knob; with a label it reads as a pressed pill when on, or (plain)
 * a thin track beside its text with no box.
 */
const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, onCheckedChange, children, className, onClick, look = "pill", ...props }, ref) => {
    if (look === "plain") {
      return (
        <button
          ref={ref}
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={(event) => {
            onClick?.(event);
            if (!event.defaultPrevented) onCheckedChange(!checked);
          }}
          className={cn(
            "inline-flex min-h-8 items-center gap-2 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
            checked ? "text-ink" : "text-text2",
            className
          )}
          {...props}
        >
          <span
            aria-hidden="true"
            className={cn(
              "flex h-3 w-6 shrink-0 p-px",
              checked ? "justify-end bg-primary" : "justify-start bg-border"
            )}
          >
            <span className={cn("h-2.5 w-2.5", checked ? "bg-on-accent" : "bg-muted-foreground")} />
          </span>
          {children}
        </button>
      );
    }
    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) onCheckedChange(!checked);
        }}
        className={cn(
          "inline-flex items-center gap-2.5 text-[13px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
          children ? "min-h-11 border px-3" : "p-1",
          children &&
            (checked
              ? "border-accent-line bg-accent-soft text-accent-hi"
              : "border-border bg-transparent text-text2"),
          className
        )}
        {...props}
      >
        <span
          aria-hidden="true"
          className={cn(
            "flex h-[18px] w-[34px] shrink-0 p-0.5",
            checked ? "justify-end bg-primary" : "justify-start bg-border"
          )}
        >
          <span className={cn("h-3.5 w-3.5", checked ? "bg-on-accent" : "bg-muted-foreground")} />
        </span>
        {children}
      </button>
    );
  }
);
Switch.displayName = "Switch";

export { Switch };
