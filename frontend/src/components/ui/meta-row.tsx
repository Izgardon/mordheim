import * as React from "react";

// utils
import { cn } from "@/lib/utils";

type MetaRowProps = {
  label: React.ReactNode;
  meta: React.ReactNode;
  tooltip?: React.ReactNode;
  className?: string;
  rowClassName?: string;
  labelClassName?: string;
  metaClassName?: string;
  tooltipClassName?: string;
};

export function MetaRow({
  label,
  meta,
  tooltip,
  className,
  rowClassName,
  labelClassName,
  metaClassName,
  tooltipClassName,
}: MetaRowProps) {
  const hasTooltip = Boolean(tooltip);
  const tooltipId = React.useId();

  return (
    <div className={cn("group relative", className)}>
      <button
        type="button"
        className={cn(
          "flex w-full items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-left text-sm text-foreground shadow-[0_10px_20px_rgba(5,20,24,0.25)] transition hover:border-primary/60 hover:bg-background/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          hasTooltip ? "cursor-pointer" : "cursor-default",
          rowClassName
        )}
        aria-describedby={hasTooltip ? tooltipId : undefined}
      >
        <span className={cn("min-w-0 flex-1 truncate font-semibold", labelClassName)}>
          {label}
        </span>
        <span className={cn("shrink-0 text-xs text-muted-foreground", metaClassName)}>
          {meta}
        </span>
      </button>
      {hasTooltip ? (
        <div
          id={tooltipId}
          role="tooltip"
          className={cn(
            "pointer-events-none absolute left-0 top-full z-20 mt-2 w-full min-w-[220px] max-w-xs translate-y-1 rounded-2xl border border-border/60 bg-card/95 p-3 text-xs text-foreground shadow-[0_18px_30px_rgba(5,20,24,0.4)] opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100",
            tooltipClassName
          )}
        >
          {tooltip}
        </div>
      ) : null}
    </div>
  );
}
