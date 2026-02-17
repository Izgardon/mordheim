import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type CollapsibleSectionProps = {
  title: string;
  summary?: ReactNode;
  collapsed: boolean;
  onToggle: () => void;
  disabled?: boolean;
  children: ReactNode;
};

export default function CollapsibleSection({
  title,
  summary,
  collapsed,
  onToggle,
  disabled,
  children,
}: CollapsibleSectionProps) {
  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        aria-expanded={!collapsed}
        className={cn(
          "flex w-full items-center justify-between gap-3 text-left",
          disabled && "cursor-not-allowed opacity-60"
        )}
      >
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
          <span className="text-muted-foreground">{title}</span>
          {summary ?? null}
        </div>
        <span
          className={cn(
            "icon-button h-7 w-7 transition-[filter] hover:brightness-125",
            disabled && "opacity-60"
          )}
          aria-hidden="true"
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform duration-200",
              collapsed ? "-rotate-90" : "rotate-0"
            )}
          />
        </span>
      </button>
      <div
        className={cn(
          "overflow-hidden transition-[max-height,opacity] duration-300 ease-out",
          collapsed ? "max-h-0 opacity-0" : "max-h-[1200px] opacity-100"
        )}
      >
        <div className={cn("pt-1", collapsed && "pointer-events-none")}>{children}</div>
      </div>
    </div>
  );
}
