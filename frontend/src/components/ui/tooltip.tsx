import * as React from "react";
import { createPortal } from "react-dom";

import scrollBg from "@/assets/containers/scroll_light.png";

export type TooltipProps = {
  trigger: React.ReactNode;
  content: React.ReactNode;
  className?: string;
  contentClassName?: string;
  minWidth?: number;
  maxWidth?: number;
} & Omit<React.HTMLAttributes<HTMLSpanElement>, "children" | "content">;

const pickForwardedSpanProps = (props: Record<string, unknown>): React.HTMLAttributes<HTMLSpanElement> => {
  const forwarded: React.HTMLAttributes<HTMLSpanElement> = {};

  for (const [key, value] of Object.entries(props)) {
    if (
      key.startsWith("data-") ||
      key.startsWith("aria-") ||
      key === "id" ||
      key === "title" ||
      key === "role" ||
      key === "tabIndex" ||
      key === "style" ||
      key === "lang" ||
      key === "dir"
    ) {
      (forwarded as Record<string, unknown>)[key] = value;
    }
  }

  return forwarded;
};

export const Tooltip = React.forwardRef<HTMLSpanElement, TooltipProps>(function Tooltip(
  {
    trigger,
    content,
    className,
    contentClassName,
    minWidth,
    maxWidth = 900,
    onMouseEnter,
    onMouseLeave,
    onFocus,
    onBlur,
    onClick,
    ...rest
  },
  ref
) {
  const triggerRef = React.useRef<HTMLSpanElement | null>(null);
  const tooltipRef = React.useRef<HTMLDivElement | null>(null);
  const tooltipId = React.useId();
  const [isOpen, setIsOpen] = React.useState(false);
  const [style, setStyle] = React.useState<{ top: number; left: number; maxWidth: number } | null>(null);
  const forwardedSpanProps = React.useMemo(
    () => pickForwardedSpanProps(rest as Record<string, unknown>),
    [rest]
  );

  const updatePosition = React.useCallback(() => {
    if (!triggerRef.current) {
      return;
    }
    const viewportPadding = 12;
    const gap = 8;
    const rect = triggerRef.current.getBoundingClientRect();
    const availableWidth = Math.max(0, window.innerWidth - viewportPadding * 2);
    const resolvedMaxWidth = Math.min(maxWidth, availableWidth);
    const resolvedMinWidth =
      minWidth === undefined ? undefined : Math.min(minWidth, resolvedMaxWidth);
    const tooltipWidth =
      tooltipRef.current?.offsetWidth ??
      Math.min(resolvedMaxWidth, Math.max(resolvedMinWidth ?? 0, 240));
    const tooltipHeight = tooltipRef.current?.offsetHeight ?? 0;

    const triggerCenter = rect.left + rect.width / 2;
    let left = triggerCenter - tooltipWidth / 2;
    left = Math.max(
      viewportPadding,
      Math.min(left, window.innerWidth - viewportPadding - tooltipWidth)
    );

    let top = rect.bottom + gap;
    if (top + tooltipHeight > window.innerHeight - viewportPadding) {
      top = rect.top - gap - tooltipHeight;
    }
    top = Math.max(
      viewportPadding,
      Math.min(top, window.innerHeight - viewportPadding - tooltipHeight)
    );

    setStyle({ top, left, maxWidth: resolvedMaxWidth });
  }, [maxWidth, minWidth]);

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }
    updatePosition();
    const frame = requestAnimationFrame(updatePosition);
    const handleUpdate = () => updatePosition();
    window.addEventListener("scroll", handleUpdate, true);
    window.addEventListener("resize", handleUpdate);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", handleUpdate, true);
      window.removeEventListener("resize", handleUpdate);
    };
  }, [content, isOpen, updatePosition]);

  const handleMouseEnter: React.MouseEventHandler<HTMLSpanElement> = (event) => {
    onMouseEnter?.(event);
    if (!event.defaultPrevented) {
      setIsOpen(true);
    }
  };

  const handleMouseLeave: React.MouseEventHandler<HTMLSpanElement> = (event) => {
    onMouseLeave?.(event);
    if (!event.defaultPrevented) {
      setIsOpen(false);
    }
  };

  const handleFocus: React.FocusEventHandler<HTMLSpanElement> = (event) => {
    onFocus?.(event);
    if (!event.defaultPrevented) {
      setIsOpen(true);
    }
  };

  const handleBlur: React.FocusEventHandler<HTMLSpanElement> = (event) => {
    onBlur?.(event);
    if (!event.defaultPrevented) {
      setIsOpen(false);
    }
  };

  const handleClick: React.MouseEventHandler<HTMLSpanElement> = (event) => {
    onClick?.(event);
    if (!event.defaultPrevented) {
      setIsOpen((prev) => !prev);
    }
  };

  return (
    <span
      ref={(node) => {
        triggerRef.current = node;
        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      }}
      className={className}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onClick={handleClick}
      aria-describedby={tooltipId}
      {...forwardedSpanProps}
    >
      {trigger}
      {isOpen && style && typeof document !== "undefined"
        ? createPortal(
            <div
              id={tooltipId}
              ref={tooltipRef}
              role="tooltip"
              className={
                contentClassName ??
                "tooltip-unfurl fixed z-[60] rounded-md bg-cover bg-center bg-no-repeat p-4 text-sm italic text-[#2a1f1a] shadow-lg"
              }
              style={{
                top: style.top,
                left: style.left,
                minWidth:
                  minWidth === undefined
                    ? undefined
                    : Math.min(minWidth, style.maxWidth),
                maxWidth: style.maxWidth,
                backgroundImage: `url(${scrollBg})`,
              }}
            >
              {content}
            </div>,
            document.body
          )
        : null}
    </span>
  );
});
