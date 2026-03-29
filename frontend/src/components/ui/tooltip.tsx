import * as React from "react";
import { createPortal } from "react-dom";

export type TooltipProps = {
  trigger: React.ReactNode;
  content: React.ReactNode;
  className?: string;
  contentClassName?: string;
  minWidth?: number;
  maxWidth?: number;
  maxHeight?: string;
  side?: "top" | "bottom";
  openOnHover?: boolean;
  onOpenChange?: (open: boolean) => void;
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
    maxHeight = "60vh",
    side = "bottom",
    openOnHover = true,
    onOpenChange,
    onMouseEnter,
    onMouseLeave,
    onFocus,
    onBlur,
    onClick,
    onPointerDown,
    ...rest
  },
  ref
) {
  const triggerRef = React.useRef<HTMLSpanElement | null>(null);
  const tooltipRef = React.useRef<HTMLDivElement | null>(null);
  const tooltipId = React.useId();
  const [isOpen, setIsOpen] = React.useState(false);
  const [style, setStyle] = React.useState<{ top: number; left: number; maxWidth: number } | null>(null);
  const suppressClickRef = React.useRef(false);
  const suppressFocusRef = React.useRef(false);
  const focusResetTimerRef = React.useRef<number | null>(null);
  const ignoreBlurRef = React.useRef(false);
  const blurResetTimerRef = React.useRef<number | null>(null);
  const forwardedSpanProps = React.useMemo(
    () => pickForwardedSpanProps(rest as Record<string, unknown>),
    [rest]
  );

  React.useEffect(() => {
    return () => {
      if (focusResetTimerRef.current !== null) {
        window.clearTimeout(focusResetTimerRef.current);
      }
      if (blurResetTimerRef.current !== null) {
        window.clearTimeout(blurResetTimerRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }
      if (triggerRef.current?.contains(target) || tooltipRef.current?.contains(target)) {
        return;
      }
      setIsOpen(false);
    };
    window.addEventListener("pointerdown", handleOutsidePointerDown, true);
    return () => {
      window.removeEventListener("pointerdown", handleOutsidePointerDown, true);
    };
  }, [isOpen]);

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

    const spaceAbove = Math.max(0, rect.top - viewportPadding - gap);
    const spaceBelow = Math.max(0, window.innerHeight - rect.bottom - viewportPadding - gap);
    const fitsAbove = tooltipHeight <= spaceAbove;
    const fitsBelow = tooltipHeight <= spaceBelow;

    let resolvedSide = side;
    if (side === "bottom") {
      if (!fitsBelow && (fitsAbove || spaceAbove > spaceBelow)) {
        resolvedSide = "top";
      }
    } else if (!fitsAbove && (fitsBelow || spaceBelow > spaceAbove)) {
      resolvedSide = "bottom";
    }

    let top =
      resolvedSide === "top" ? rect.top - gap - tooltipHeight : rect.bottom + gap;
    top = Math.max(
      viewportPadding,
      Math.min(top, window.innerHeight - viewportPadding - tooltipHeight)
    );

    setStyle((current) => {
      if (
        current &&
        current.top === top &&
        current.left === left &&
        current.maxWidth === resolvedMaxWidth
      ) {
        return current;
      }
      return { top, left, maxWidth: resolvedMaxWidth };
    });
  }, [maxWidth, minWidth, side]);

  React.useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }
    updatePosition();
    const frame = requestAnimationFrame(updatePosition);
    const handleUpdate = () => updatePosition();
    const observer =
      typeof ResizeObserver !== "undefined" && tooltipRef.current
        ? new ResizeObserver(handleUpdate)
        : null;
    if (observer && tooltipRef.current) {
      observer.observe(tooltipRef.current);
    }
    window.addEventListener("scroll", handleUpdate, true);
    window.addEventListener("resize", handleUpdate);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("scroll", handleUpdate, true);
      window.removeEventListener("resize", handleUpdate);
    };
  }, [content, isOpen, updatePosition]);

  const handleMouseEnter: React.MouseEventHandler<HTMLSpanElement> = (event) => {
    onMouseEnter?.(event);
    if (!event.defaultPrevented && openOnHover) {
      setIsOpen(true);
    }
  };

  const handleMouseLeave: React.MouseEventHandler<HTMLSpanElement> = (event) => {
    onMouseLeave?.(event);
    if (!event.defaultPrevented && openOnHover) {
      setIsOpen(false);
    }
  };

  const handleFocus: React.FocusEventHandler<HTMLSpanElement> = (event) => {
    onFocus?.(event);
    if (!event.defaultPrevented && openOnHover) {
      if (suppressFocusRef.current) {
        return;
      }
      setIsOpen(true);
    }
  };

  const handleBlur: React.FocusEventHandler<HTMLSpanElement> = (event) => {
    onBlur?.(event);
    if (!event.defaultPrevented && openOnHover) {
      if (ignoreBlurRef.current) {
        return;
      }
      setIsOpen(false);
    }
  };

  const handleClick: React.MouseEventHandler<HTMLSpanElement> = (event) => {
    onClick?.(event);
    if (!event.defaultPrevented) {
      if (suppressClickRef.current) {
        suppressClickRef.current = false;
        return;
      }
      setIsOpen((prev) => !prev);
    }
  };

  const handlePointerDown: React.PointerEventHandler<HTMLSpanElement> = (event) => {
    onPointerDown?.(event);
    if (event.defaultPrevented) {
      return;
    }
    if (event.pointerType === "touch" || event.pointerType === "pen") {
      suppressClickRef.current = true;
      suppressFocusRef.current = true;
      if (focusResetTimerRef.current !== null) {
        window.clearTimeout(focusResetTimerRef.current);
      }
      focusResetTimerRef.current = window.setTimeout(() => {
        suppressFocusRef.current = false;
      }, 0);
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
      onPointerDown={handlePointerDown}
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
                "tooltip-unfurl fixed z-[60] overflow-y-auto rounded-sm border border-border/70 bg-popover p-4 text-sm text-popover-foreground shadow-lg"
              }
              onPointerDown={() => {
                ignoreBlurRef.current = true;
                if (blurResetTimerRef.current !== null) {
                  window.clearTimeout(blurResetTimerRef.current);
                }
                blurResetTimerRef.current = window.setTimeout(() => {
                  ignoreBlurRef.current = false;
                }, 0);
              }}
              style={{
                top: style.top,
                left: style.left,
                minWidth:
                  minWidth === undefined
                    ? undefined
                    : Math.min(minWidth, style.maxWidth),
                maxWidth: style.maxWidth,
                maxHeight,
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
