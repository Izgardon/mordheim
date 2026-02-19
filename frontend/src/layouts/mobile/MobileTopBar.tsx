import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type MobileTopBarProps = {
  title: string;
  leftSlot?: ReactNode;
  rightSlot?: ReactNode;
  meta?: ReactNode;
  className?: string;
  titleClassName?: string;
};

export default function MobileTopBar({
  title,
  leftSlot,
  rightSlot,
  meta,
  className,
  titleClassName,
}: MobileTopBarProps) {
  return (
    <div className={cn("fixed inset-x-0 top-0 z-50", className)}>
      <div className="bg-[#0b0a08]/85 backdrop-blur-md">
        <div className="flex min-h-[3.25rem] items-center justify-between px-4 pb-2 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)]">
          <div className="flex min-w-0 items-center gap-3">
            {leftSlot ? <div className="flex items-center">{leftSlot}</div> : null}
            <div className="flex min-w-0 flex-col">
              <span
                className={cn(
                  "truncate font-display text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-[#e9dcc2]",
                  titleClassName
                )}
              >
                {title}
              </span>
            </div>
          </div>
          {rightSlot ? <div className="flex items-center gap-2">{rightSlot}</div> : null}
        </div>
        {meta ? (
          <div className="flex items-center gap-4 px-4 pb-3 text-xs font-semibold text-[#e9dcc2]">
            {meta}
          </div>
        ) : null}
      </div>
      <div className="h-px w-full bg-[#2b2117]/80" />
    </div>
  );
}
