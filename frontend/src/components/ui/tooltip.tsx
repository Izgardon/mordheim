import * as React from "react";
import { createPortal } from "react-dom";

export type TooltipProps = {
  trigger: React.ReactNode;
  content: React.ReactNode;
  className?: string;
  contentClassName?: string;
  minWidth?: number;
  maxWidth?: number;
};

export function Tooltip({
  trigger,
  content,
  className,
  contentClassName,
  minWidth = 320,
  maxWidth = 520,
}: TooltipProps) {
  const triggerRef = React.useRef<HTMLSpanElement | null>(null);
  const tooltipId = React.useId();
  const [isOpen, setIsOpen] = React.useState(false);
  const [style, setStyle] = React.useState<{ top: number; left: number; width: number } | null>(
    null
  );

  const updatePosition = React.useCallback(() => {
    if (!triggerRef.current) {
      return;
    }
    const rect = triggerRef.current.getBoundingClientRect();
    const max = Math.min(maxWidth, window.innerWidth - 24);
    const width = Math.min(Math.max(rect.width, minWidth), max);
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
    const top = Math.min(rect.bottom + 8, window.innerHeight - 12);
    setStyle({ top, left, width });
  }, [maxWidth, minWidth]);

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }
    updatePosition();
    const handleUpdate = () => updatePosition();
    window.addEventListener("scroll", handleUpdate, true);
    window.addEventListener("resize", handleUpdate);
    return () => {
      window.removeEventListener("scroll", handleUpdate, true);
      window.removeEventListener("resize", handleUpdate);
    };
  }, [isOpen, updatePosition]);

  return (
    <span
      ref={triggerRef}
      className={className}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      onFocus={() => setIsOpen(true)}
      onBlur={() => setIsOpen(false)}
      onClick={() => setIsOpen((prev) => !prev)}
      aria-describedby={tooltipId}
    >
      {trigger}
      {isOpen && style && typeof document !== "undefined"
        ? createPortal(
            <div
              id={tooltipId}
              role="tooltip"
              className={
                contentClassName ??
                "pointer-events-none fixed z-[60] rounded-2xl border border-border/60 bg-card/95 p-4 text-sm text-foreground shadow-[0_18px_30px_rgba(5,20,24,0.4)]"
              }
              style={{ top: style.top, left: style.left, width: style.width }}
            >
              {content}
            </div>,
            document.body
          )
        : null}
    </span>
  );
}
