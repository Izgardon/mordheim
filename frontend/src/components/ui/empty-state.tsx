import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type EmptyStateProps = {
  children: ReactNode;
  className?: string;
};

/** Loaded successfully, with nothing to show. Use ErrorState when the load failed. */
export function EmptyState({ children, className }: EmptyStateProps) {
  return (
    <p className={cn("m-0 py-8 text-center text-sm text-muted-foreground", className)}>
      {children}
    </p>
  );
}
