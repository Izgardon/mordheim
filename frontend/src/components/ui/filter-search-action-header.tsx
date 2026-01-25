import * as React from "react";

// utils
import { cn } from "@/lib/utils";

type FilterSearchActionHeaderProps = {
  filters?: React.ReactNode;
  search?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  leftClassName?: string;
  rightClassName?: string;
};

export default function FilterSearchActionHeader({
  filters,
  search,
  actions,
  className,
  leftClassName,
  rightClassName,
}: FilterSearchActionHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className={cn("flex flex-wrap items-center gap-3", leftClassName)}>
        {filters}
        {search}
      </div>
      {actions ? <div className={cn("flex items-center gap-3", rightClassName)}>{actions}</div> : null}
    </div>
  );
}
