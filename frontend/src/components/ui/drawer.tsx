import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { closeListFirst, DialogKicker, keepOpenForPortals } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";

type DrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The small accent line above the title ("Store", "Battle 5"). */
  kicker?: React.ReactNode;
  title: React.ReactNode;
  /** Read to screen readers with the title (sr-only). */
  description?: string;
  /** Beside the close button: a gold total, a count. */
  actions?: React.ReactNode;
  /** Between the body and the footer, outside the scroll: the picked item's details. */
  dock?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

/** A panel from the right (about 600 px) over a scrim: the store, the stash, the dice. */
export function Drawer({
  open,
  onOpenChange,
  kicker,
  title,
  description,
  actions,
  dock,
  footer,
  children,
  className,
}: DrawerProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-scrim data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          {...(description ? {} : { "aria-describedby": undefined })}
          onInteractOutside={keepOpenForPortals}
          onEscapeKeyDown={closeListFirst}
          className={cn(
            "fixed inset-y-0 right-0 z-[60] flex w-[600px] max-w-full flex-col border-l border-accent-line bg-panel text-ink shadow-[-18px_0_40px_var(--color-shadow)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
            className
          )}
        >
          <header className="flex items-start justify-between gap-3 border-b border-line px-6 pb-4 pt-5">
            <div className="flex min-w-0 flex-col gap-0.5">
              {kicker ? <DialogKicker>{kicker}</DialogKicker> : null}
              <DialogPrimitive.Title className="font-display text-[26px] font-semibold leading-tight text-head">
                {title}
              </DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="sr-only">
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-3.5">
              {actions}
              <DialogPrimitive.Close asChild>
                <IconButton aria-label="Close panel">
                  <X aria-hidden="true" />
                </IconButton>
              </DialogPrimitive.Close>
            </div>
          </header>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 pb-6 pt-[18px]">
            {children}
          </div>
          {dock ? (
            <div className="max-h-[45dvh] shrink-0 overflow-y-auto border-t border-accent-line bg-surface px-6 py-4">
              {dock}
            </div>
          ) : null}
          {footer ? <footer className="border-t border-line px-6 py-4">{footer}</footer> : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
