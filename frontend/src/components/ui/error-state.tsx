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
  /** "card" frames it on its own (a whole screen that failed); "inline" sits in a page or panel. */
  look?: "inline" | "card";
  className?: string;
};

/**
 * A failed load or action (design E): what went wrong and a way to try again. Not an empty state.
 */
export function ErrorState({
  message,
  title,
  onRetry,
  retryLabel = "Retry",
  actions,
  look = "inline",
  className,
}: ErrorStateProps) {
  const isCard = look === "card";
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col gap-3",
        isCard
          ? "w-full max-w-[480px] items-start border border-border bg-surface p-8 text-left max-[960px]:p-6"
          : "items-center justify-center px-6 py-8 text-center",
        className
      )}
    >
      {isCard ? (
        <span className="font-mono text-xs uppercase tracking-[0.16em] text-danger">Error</span>
      ) : null}
      {title ? (
        <p
          className={cn(
            "m-0 font-display font-semibold leading-tight text-head",
            isCard ? "text-[30px]" : "text-xl"
          )}
        >
          {title}
        </p>
      ) : null}
      <p className="m-0 max-w-[420px] text-sm text-text2">{message}</p>
      {onRetry || actions ? (
        <div className={cn("flex flex-wrap items-center gap-2 pt-1", !isCard && "justify-center")}>
          {onRetry ? (
            <Button type="button" onClick={onRetry}>
              {retryLabel}
            </Button>
          ) : null}
          {actions}
        </div>
      ) : null}
    </div>
  );
}
