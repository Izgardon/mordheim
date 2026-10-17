import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Button } from "./button";

type ErrorStateProps = {
  message: string;
  title?: string;
  onRetry?: () => void;
  retryLabel?: string;
  /** Extra actions next to Retry, e.g. a link back to the campaigns list. */
  actions?: ReactNode;
  className?: string;
};

/** A failed load or action: what went wrong and a way to try again. Not an empty state. */
export function ErrorState({
  message,
  title,
  onRetry,
  retryLabel = "Retry",
  actions,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-8 text-center",
        className
      )}
    >
      {title ? <p className="text-sm font-semibold text-foreground">{title}</p> : null}
      <p className="text-sm text-muted-foreground">{message}</p>
      {onRetry || actions ? (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {onRetry ? (
            <Button type="button" size="sm" onClick={onRetry}>
              {retryLabel}
            </Button>
          ) : null}
          {actions}
        </div>
      ) : null}
    </div>
  );
}
