import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type MobileTopBarProps = {
  title: string;
  leftSlot?: ReactNode;
  rightSlot?: ReactNode;
  meta?: ReactNode;
  position?: "fixed" | "sticky";
  className?: string;
  titleClassName?: string;
};

export default function MobileTopBar({
  title,
  leftSlot,
  rightSlot,
  meta,
  position = "fixed",
  className,
  titleClassName,
}: MobileTopBarProps) {
  const positionClassName = position === "sticky" ? "sticky" : "fixed";
  return (
    <div className={cn(positionClassName, "inset-x-0 top-0 z-50", className)}>
      <div className="border-b border-[#2f2419] bg-black/95 shadow-[0_14px_32px_rgba(0,0,0,0.45)] backdrop-blur-md">
        <div className="flex min-h-[3.25rem] items-center justify-between px-4 pb-2 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)]">
          <div className="flex min-w-0 items-center gap-3">
            {leftSlot ? (
              <div className="flex items-center text-[color:var(--color-icon-soft)] [&_.btn-icon]:border-[#4c3a2a] [&_.btn-icon]:bg-[#0f0c09] [&_.btn-icon]:text-[color:var(--color-icon-soft)] [&_.icon-button]:text-[color:var(--color-icon-soft)] [&_.theme-heading-soft]:text-[color:var(--color-icon-soft)] [&_.theme-icon-soft]:text-[color:var(--color-icon-soft)] [&_.theme-icon-strong]:text-[color:var(--color-icon-strong)] [&_svg]:text-[color:var(--color-icon-soft)]">
                {leftSlot}
              </div>
            ) : null}
            <div className="flex min-w-0 flex-col">
              <span
                className={cn(
                  "truncate font-display text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-[color:var(--color-icon-strong)]",
                  titleClassName
                )}
              >
                {title}
              </span>
            </div>
          </div>
          {rightSlot ? (
            <div className="flex items-center gap-2 text-[color:var(--color-icon-soft)] [&_.btn-icon]:border-[#4c3a2a] [&_.btn-icon]:bg-[#0f0c09] [&_.btn-icon]:text-[color:var(--color-icon-soft)] [&_.icon-button]:text-[color:var(--color-icon-soft)] [&_.theme-heading-soft]:text-[color:var(--color-icon-soft)] [&_.theme-icon-soft]:text-[color:var(--color-icon-soft)] [&_.theme-icon-strong]:text-[color:var(--color-icon-strong)] [&_svg]:text-[color:var(--color-icon-soft)]">
              {rightSlot}
            </div>
          ) : null}
        </div>
        {meta ? (
          <div className="flex items-center gap-4 px-4 pb-3 text-xs font-semibold text-[color:var(--color-icon-soft)]">
            {meta}
          </div>
        ) : null}
      </div>
    </div>
  );
}
