import * as React from "react";

import { cn } from "@/lib/utils";

const CHIP_BASE =
  "inline-flex min-h-[34px] items-center gap-1.5 border px-3 text-[13px] font-semibold transition-colors";
const PRESSED = "border-accent-line bg-accent-soft text-accent-hi";

export type ChipProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "aria-pressed"> & {
  /** Pressed (a filter that is on, a picked option): accent-soft fill, accent line, accent text. */
  pressed?: boolean;
};

/** A pill the user presses: a filter, a category, a choice among a few. */
const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(
  ({ className, pressed = false, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-pressed={pressed}
      className={cn(
        CHIP_BASE,
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
        pressed
          ? PRESSED
          : "border-border bg-transparent text-text2 hover:bg-raised hover:text-ink",
        className
      )}
      {...props}
    />
  )
);
Chip.displayName = "Chip";

const TONES = {
  default: "border-border text-text2",
  accent: PRESSED,
  danger: "border-danger-line bg-danger-bg text-danger",
  good: "border-good-line bg-good-bg text-good",
} as const;

export type ChipLabelProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: keyof typeof TONES;
};

/** A chip that only labels (a role, "Archived", "Missing · 1 game"); nothing to press. */
function ChipLabel({ className, tone = "default", ...props }: ChipLabelProps) {
  return (
    <span
      className={cn(CHIP_BASE, "min-h-[28px] px-2.5 text-xs font-bold", TONES[tone], className)}
      {...props}
    />
  );
}

export { Chip, ChipLabel };
