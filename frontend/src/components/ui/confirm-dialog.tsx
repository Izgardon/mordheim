import type { ReactNode } from "react"

import { Button, type ButtonProps } from "@components/button"
import { Dialog, DialogContent } from "@components/dialog"
import { cn } from "@/lib/utils"

type ConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  description: ReactNode
  confirmText?: string
  cancelText?: string
  confirmVariant?: ButtonProps["variant"]
  cancelVariant?: ButtonProps["variant"]
  confirmDisabled?: boolean
  isConfirming?: boolean
  onConfirm: () => void
  onCancel?: () => void
  className?: string
}

export function ConfirmDialog({
  open,
  onOpenChange,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmVariant = "destructive",
  cancelVariant = "secondary",
  confirmDisabled = false,
  isConfirming = false,
  onConfirm,
  onCancel,
  className,
}: ConfirmDialogProps) {
  const handleCancel = () => {
    onCancel?.()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-w-[520px]", className)}>
        <div className="text-sm text-muted-foreground">{description}</div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
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
        </div>
      </DialogContent>
    </Dialog>
  )
}
