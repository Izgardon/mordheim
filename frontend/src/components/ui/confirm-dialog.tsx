import type { ReactNode } from "react";

import { Button, type ButtonProps } from "@components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@components/dialog";
import { cn } from "@/lib/utils";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  description: ReactNode;
  /** Shown as the dialog's title (design E); without one, the confirm button's text names it, unseen. */
  title?: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: ButtonProps["variant"];
  cancelVariant?: ButtonProps["variant"];
  confirmDisabled?: boolean;
  isConfirming?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
  className?: string;
  /** More to read under the message, e.g. what the action would affect. */
  children?: ReactNode;
  /** Why the last confirm failed: shown here, in the dialog that stays open, not behind it. */
  error?: string;
};

export function ConfirmDialog({
  open,
  onOpenChange,
  description,
  title,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmVariant = "danger",
  cancelVariant = "secondary",
  confirmDisabled = false,
  isConfirming = false,
  onConfirm,
  onCancel,
  className,
  children,
  error,
}: ConfirmDialogProps) {
  const handleCancel = () => {
    onCancel?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-w-[520px]", className)}>
        {/* Design E: a named confirm shows its name as the title; without one it is read only. */}
        <DialogTitle className={title ? "text-[24px]" : "sr-only"}>
          {title ?? confirmText}
        </DialogTitle>
        <DialogDescription asChild className="block text-[15px] leading-relaxed text-text2">
          <div>{description}</div>
        </DialogDescription>
        {children}
        {error ? (
          <p
            role="alert"
            className="m-0 border border-danger-line bg-danger-bg px-3.5 py-3 text-sm text-danger"
          >
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant={cancelVariant} onClick={handleCancel} disabled={isConfirming}>
            {cancelText}
          </Button>
          <Button
            variant={confirmVariant}
            onClick={onConfirm}
            disabled={isConfirming || confirmDisabled}
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
