import { ConfirmDialog } from "@components/confirm-dialog";

import type { CampaignMember } from "../../types/campaign-types";

type HandOverDialogProps = {
  campaignName: string;
  target: CampaignMember | null;
  error: string;
  isHandingOver: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

/** The hand-over's confirm: who becomes the owner, and that you become an admin. */
export default function HandOverDialog({
  campaignName,
  target,
  error,
  isHandingOver,
  onClose,
  onConfirm,
}: HandOverDialogProps) {
  return (
    <ConfirmDialog
      open={Boolean(target)}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      title="Hand over the campaign"
      description={
        <div className="space-y-2">
          <p>{`Make ${target?.name ?? "them"} the owner of ${campaignName}?`}</p>
          <p className="text-sm text-muted-foreground">
            You become an admin. Only the owner changes roles, archives the campaign or hands it on,
            so to have it back, ask them to hand it back.
          </p>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
      }
      confirmText={isHandingOver ? "Handing over..." : "Make owner"}
      confirmVariant="secondary"
      confirmDisabled={isHandingOver}
      isConfirming={isHandingOver}
      onConfirm={onConfirm}
      onCancel={onClose}
    />
  );
}
