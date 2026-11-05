import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { closeListFirst, DialogKicker, keepOpenForPortals } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";

/** How far the handle must be dragged down before letting go closes the sheet. */
export const SHEET_DISMISS_DISTANCE = 80;

type BottomSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The small accent line above the title ("Battle 5", "Quick reference"). */
  kicker?: React.ReactNode;
  title: React.ReactNode;
  /** Read to screen readers with the title (sr-only). */
  description?: string;
  /** Between the body and the footer, outside the scroll: the picked item's details. */
  dock?: React.ReactNode;
  /** Stays below the scrolling body: the sheet's confirm or cancel. */
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

/** Dragging the handle down moves the sheet with the finger; far enough closes it. */
function useDragToClose(onClose: () => void) {
  const start = React.useRef<number | null>(null);
  const [offset, setOffset] = React.useState(0);
  const end = (clientY: number | null) => {
    const distance = start.current === null || clientY === null ? 0 : clientY - start.current;
    start.current = null;
    setOffset(0);
    if (distance > SHEET_DISMISS_DISTANCE) onClose();
  };
  return {
    offset,
    handleProps: {
      onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
        start.current = event.clientY;
        event.currentTarget.setPointerCapture?.(event.pointerId);
      },
      onPointerMove: (event: React.PointerEvent<HTMLElement>) => {
        if (start.current !== null) setOffset(Math.max(0, event.clientY - start.current));
      },
      onPointerUp: (event: React.PointerEvent<HTMLElement>) => end(event.clientY),
      onPointerCancel: () => end(null),
    },
  };
}

/** The phone's sheet from the bottom: a drag handle, a header, a scrolling body, a footer. */
export function BottomSheet({
  open,
  onOpenChange,
  kicker,
  title,
  description,
  dock,
  footer,
  children,
  className,
}: BottomSheetProps) {
  const { offset, handleProps } = useDragToClose(() => onOpenChange(false));

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* Taps outside close the sheet through onInteractOutside (pointerdown), so the scrim takes
            no clicks: iOS's delayed ghost clicks can't land on it and close the next sheet. */}
        <DialogPrimitive.Overlay className="pointer-events-none fixed inset-0 z-50 bg-scrim data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          {...(description ? {} : { "aria-describedby": undefined })}
          onInteractOutside={keepOpenForPortals}
          onEscapeKeyDown={closeListFirst}
          onOpenAutoFocus={(event) => event.preventDefault()}
          style={offset ? { transform: `translateY(${offset}px)` } : undefined}
          className={cn(
            "fixed inset-x-0 bottom-0 z-[60] flex max-h-[85dvh] flex-col border-t border-accent-line bg-panel text-ink shadow-[0_-16px_40px_var(--color-shadow)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
            className
          )}
        >
          <div
            {...handleProps}
            data-testid="sheet-handle"
            aria-hidden="true"
            className="flex touch-none justify-center pb-2 pt-2"
          >
            <span className="h-1 w-10 bg-strong" />
          </div>
          <header className="flex items-start justify-between gap-3 px-4 pb-2.5">
            <div className="flex min-w-0 flex-col gap-px">
              {kicker ? <DialogKicker className="tracking-[0.12em]">{kicker}</DialogKicker> : null}
              <DialogPrimitive.Title className="font-display text-[21px] font-semibold leading-tight text-head">
                {title}
              </DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="sr-only">
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>
            <DialogPrimitive.Close asChild>
              <IconButton aria-label="Close">
                <X aria-hidden="true" />
              </IconButton>
            </DialogPrimitive.Close>
          </header>
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4">
            {children}
          </div>
          {dock ? (
            <div className="max-h-[40dvh] shrink-0 overflow-y-auto border-t border-accent-line bg-surface px-4 py-3">
              {dock}
            </div>
          ) : null}
          {footer ? (
            <footer className="border-t border-line px-4 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] pt-3">
              {footer}
            </footer>
          ) : (
            <div className="pb-[env(safe-area-inset-bottom,0px)]" />
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
