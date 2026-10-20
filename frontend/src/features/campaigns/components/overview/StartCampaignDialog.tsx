import { ConfirmDialog } from "@components/confirm-dialog";

type StartCampaignDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isStarting: boolean;
  error: string;
  onConfirm: () => void;
};

/** Start campaign's confirm: starting enables battles and experience, and locks nothing. */
export default function StartCampaignDialog({
  open,
  onOpenChange,
  isStarting,
  error,
  onConfirm,
}: StartCampaignDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Start campaign"
      description={
        <div className="space-y-2">
          <p>Start the campaign now? Starting enables battles and experience.</p>
          <p className="text-sm text-muted-foreground">
            Nothing else is locked: settings, house rules and rosters can still change after the
            start.
          </p>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
      }
      confirmText={isStarting ? "Starting..." : "Confirm start"}
      confirmVariant="secondary"
      confirmDisabled={isStarting}
      isConfirming={isStarting}
      onConfirm={onConfirm}
      onCancel={() => onOpenChange(false)}
    />
  );
}
