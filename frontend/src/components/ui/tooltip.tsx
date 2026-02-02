import * as React from "react";
import { createPortal } from "react-dom";

import scrollBg from "@/assets/containers/scroll_light.png";

export type TooltipProps = {
  trigger: React.ReactNode;
  content: React.ReactNode;
  className?: string;
  contentClassName?: string;
  maxWidth?: number;
};

export function Tooltip({
  trigger,
  content,
  className,
  contentClassName,
  maxWidth = 900,
}: TooltipProps) {
  const triggerRef = React.useRef<HTMLSpanElement | null>(null);
  const tooltipId = React.useId();
  const [isOpen, setIsOpen] = React.useState(false);
  const [style, setStyle] = React.useState<{ top: number; left: number } | null>(null);

  const updatePosition = React.useCallback(() => {
    if (!triggerRef.current) {
      return;
    }
    const rect = triggerRef.current.getBoundingClientRect();
    const triggerCenter = rect.left + rect.width / 2;
    const left = Math.max(12, Math.min(triggerCenter, window.innerWidth - 12));
    const top = Math.min(rect.bottom + 8, window.innerHeight - 12);
    setStyle({ top, left });
  }, []);

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
                "tooltip-unfurl fixed z-[60] -translate-x-1/2 rounded-md bg-cover bg-center bg-no-repeat p-4 text-sm italic text-[#2a1f1a] shadow-lg"
              }
              style={{ top: style.top, left: style.left, maxWidth, backgroundImage: `url(${scrollBg})` }}
            >
              {content}
            </div>,
            document.body
          )
        : null}
    </span>
  );
}
