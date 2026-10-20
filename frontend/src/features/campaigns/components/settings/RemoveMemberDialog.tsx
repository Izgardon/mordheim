import { useQuery } from "@tanstack/react-query";

import { ConfirmDialog } from "@components/confirm-dialog";
import { getErrorMessage } from "@/lib/get-error-message";
import { queryKeys } from "@/lib/query-keys";

import { getMemberRemovalPreview } from "../../api/campaigns-api";

import RemovalPreview, { memberVoice } from "./RemovalPreview";

import type { CampaignMember } from "../../types/campaign-types";

type RemoveMemberDialogProps = {
  campaignId: number;
  open: boolean;
  target: CampaignMember | null;
  error: string;
  isRemoving: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

/**
 * One "Remove from campaign" action (decision 1, BUG-12, BUG-50): the dialog lists the battles
 * and trades that will close, says the warband is kept, and how to keep the player out.
 */
export default function RemoveMemberDialog({
  campaignId,
  open,
  target,
  error,
  isRemoving,
  onClose,
  onConfirm,
}: RemoveMemberDialogProps) {
  const previewQuery = useQuery({
    queryKey: queryKeys.campaign.memberRemoval(campaignId, target?.id ?? 0),
    queryFn: () => getMemberRemovalPreview(campaignId, target!.id),
    enabled: open && Boolean(target),
    staleTime: 0,
  });
  // The server always sends a display name; an email is never shown in its place (SEC-13).
  const memberName = target?.name || "this player";
  const subject = target?.name || "This player";
  const description = (
    <div className="space-y-3">
      <p>
        Remove <span className="font-semibold text-foreground">{memberName}</span> from the
        campaign?
      </p>
      {previewQuery.isPending ? (
        <p className="text-sm text-muted-foreground">Checking what this closes...</p>
      ) : previewQuery.isError ? (
        <p className="text-sm text-red-600">
          {getErrorMessage(previewQuery.error, "Couldn't check what this closes.")} Their open
          battles and trades will still close, and their warband is kept.
        </p>
      ) : (
        <RemovalPreview preview={previewQuery.data} voice={memberVoice(memberName, subject)} />
      )}
      <p className="text-xs text-muted-foreground">
        They can rejoin with the join code. To keep them out, regenerate the join code afterwards.
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
      title="Remove from campaign"
      description={description}
      confirmText={isRemoving ? "Removing..." : "Remove from campaign"}
      confirmDisabled={isRemoving || !target || previewQuery.isPending}
      isConfirming={isRemoving}
      onConfirm={onConfirm}
      onCancel={onClose}
    />
  );
}
