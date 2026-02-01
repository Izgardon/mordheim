import { ConfirmDialog } from "@components/confirm-dialog";

import type { CampaignMember } from "../../types/campaign-types";

type RemoveMemberDialogProps = {
  open: boolean;
  target: CampaignMember | null;
  error: string;
  isRemoving: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export default function RemoveMemberDialog({
  open,
  target,
  error,
  isRemoving,
  onClose,
  onConfirm,
}: RemoveMemberDialogProps) {
  const memberName = target?.user?.username ?? target?.user?.email ?? "this player";
  const description = (
    <div className="space-y-2">
      <p>
        Remove <span className="font-semibold text-foreground">{memberName}</span> from the
        campaign? This action cannot be undone.
      </p>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
      description={description}
      confirmText={isRemoving ? "Removing..." : "Remove player"}
      confirmDisabled={isRemoving || !target}
      isConfirming={isRemoving}
      onConfirm={onConfirm}
      onCancel={onClose}
    />
  );
}
