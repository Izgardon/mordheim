import { ConfirmDialog } from "@/components/ui/confirm-dialog";

/** Leaving the active page for the overview; the battle carries on and can be rejoined. */
export default function ActiveLeaveDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      description={
        <div className="space-y-2">
          <p>Leave this battle session?</p>
          <p className="text-xs text-muted-foreground">
            You can return later from the campaign overview while the battle is still ongoing.
          </p>
        </div>
      }
      confirmText="Leave"
      confirmVariant="secondary"
      onConfirm={onConfirm}
      onCancel={() => onOpenChange(false)}
    />
  );
}
