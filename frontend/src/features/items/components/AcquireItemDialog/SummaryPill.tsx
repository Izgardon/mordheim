import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type SummaryPillProps = {
  children: ReactNode;
  className?: string;
  textClassName?: string;
};

export default function SummaryPill({ children, className, textClassName }: SummaryPillProps) {
  return (
    <div
      className={cn(
        "inline-flex max-w-full items-center px-1",
        className
      )}
    >
      <span className={cn("text-sm font-semibold italic text-foreground", textClassName)}>
        {children}
      </span>
    </div>
  );
}
