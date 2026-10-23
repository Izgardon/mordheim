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
  /** Accessible name for screen readers; defaults to the confirm button's text. */
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
  confirmVariant = "destructive",
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
        <DialogTitle className="sr-only">{title ?? confirmText}</DialogTitle>
        <DialogDescription asChild className="block text-sm text-muted-foreground">
          <div>{description}</div>
        </DialogDescription>
        {children}
        {error ? (
          <p role="alert" className="text-sm text-red-600">
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
