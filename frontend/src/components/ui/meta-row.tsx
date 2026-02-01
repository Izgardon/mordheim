import * as React from "react";
import { createPortal } from "react-dom";

import scrollBg from "@/assets/containers/scroll_light.png";

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
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [isTooltipOpen, setIsTooltipOpen] = React.useState(false);
  const [tooltipStyle, setTooltipStyle] = React.useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const updateTooltipPosition = React.useCallback(() => {
    if (!containerRef.current) {
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const minWidth = 220;
    const maxWidth = Math.min(360, window.innerWidth - 24);
    const width = Math.min(Math.max(rect.width, minWidth), maxWidth);
    const triggerCenter = rect.left + rect.width / 2;
    const left = Math.max(12, Math.min(triggerCenter - width / 2, window.innerWidth - width - 12));
    const top = Math.min(rect.bottom + 8, window.innerHeight - 12);

    setTooltipStyle({ top, left, width });
  }, []);

  React.useEffect(() => {
    if (!hasTooltip || !isTooltipOpen) {
      return;
    }

    updateTooltipPosition();

    const handleUpdate = () => updateTooltipPosition();
    window.addEventListener("scroll", handleUpdate, true);
    window.addEventListener("resize", handleUpdate);

    return () => {
      window.removeEventListener("scroll", handleUpdate, true);
      window.removeEventListener("resize", handleUpdate);
    };
  }, [hasTooltip, isTooltipOpen, updateTooltipPosition]);

  return (
    <div
      ref={containerRef}
      className={cn("relative", className)}
      onMouseEnter={() => {
        if (hasTooltip) {
          setIsTooltipOpen(true);
        }
      }}
      onMouseLeave={() => {
        setIsTooltipOpen(false);
      }}
    >
      <button
        type="button"
        className={cn(
          " flex w-full items-center justify-between gap-3 rounded-xl border border-transparent bg-transparent px-3 py-2 text-left text-sm text-foreground shadow-[0_10px_20px_rgba(12,7,3,0.35)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          hasTooltip ? "cursor-pointer" : "cursor-default",
          rowClassName
        )}
        aria-describedby={hasTooltip ? tooltipId : undefined}
        onFocus={() => {
          if (hasTooltip) {
            setIsTooltipOpen(true);
          }
        }}
        onBlur={() => {
          setIsTooltipOpen(false);
        }}
      >
        <span className={cn("min-w-0 flex-1 truncate font-semibold", labelClassName)}>
          {label}
        </span>
        <span className={cn("shrink-0 text-xs text-muted-foreground", metaClassName)}>
          {meta}
        </span>
      </button>
      {hasTooltip && isTooltipOpen && tooltipStyle && typeof document !== "undefined"
        ? createPortal(
            <div
              id={tooltipId}
              role="tooltip"
              className={cn(
                "tooltip-unfurl pointer-events-none fixed z-[60] rounded-md bg-cover bg-center bg-no-repeat p-3 text-xs italic text-[#2a1f1a] shadow-lg",
                tooltipClassName
              )}
              style={{
                top: tooltipStyle.top,
                left: tooltipStyle.left,
                width: tooltipStyle.width,
                backgroundImage: `url(${scrollBg})`,
              }}
            >
              {tooltip}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
