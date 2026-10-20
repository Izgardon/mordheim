import { useQuery } from "@tanstack/react-query";

import { ConfirmDialog } from "@components/confirm-dialog";
import { getErrorMessage } from "@/lib/get-error-message";
import { queryKeys } from "@/lib/query-keys";

import { getMemberRemovalPreview } from "../../api/campaigns-api";

import type { CampaignMember, MemberRemovalPreview } from "../../types/campaign-types";

type RemoveMemberDialogProps = {
  campaignId: number;
  open: boolean;
  target: CampaignMember | null;
  error: string;
  isRemoving: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

const battleLine = (battle: MemberRemovalPreview["battles"][number], name: string) => {
  const label = `Battle #${battle.id}${battle.scenario ? `, ${battle.scenario}` : ""}`;
  return battle.outcome === "skipped"
    ? `${label} (${battle.status}): ${name} is skipped and the battle goes on without them.`
    : `${label} (${battle.status}): cancelled for everyone.`;
};

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** What the removal closes, read from the server before anything is confirmed (decision 1). */
type RemovalPreviewProps = {
  preview: MemberRemovalPreview;
  /** The member's name mid-sentence, and at the start of one. */
  name: string;
  subject: string;
};

function RemovalPreview({ preview, name, subject }: RemovalPreviewProps) {
  const hasOpenWork = preview.battles.length > 0 || preview.trades.length > 0;
  return (
    <div className="space-y-2">
      <p>
        {preview.warband
          ? `Their warband, ${preview.warband.name}, is kept: it stays in the campaign's history and comes back if ${name} rejoins.`
          : `${subject} has no warband.`}
      </p>
      {hasOpenWork ? (
        <ul className="list-disc space-y-1 pl-5" aria-label="What closes">
          {preview.battles.map((battle) => (
            <li key={`battle-${battle.id}`}>{battleLine(battle, name)}</li>
          ))}
          {preview.trades.map((trade) => (
            <li key={`trade-${trade.id}`}>
              {`Trade with ${trade.with.name} (${trade.status}): closed.`}
            </li>
          ))}
        </ul>
      ) : (
        <p>{`${subject} has no open battles or trades.`}</p>
      )}
      {preview.notifications > 0 ? (
        <p>{`${plural(preview.notifications, "notification")} waiting for ${name} will be cleared.`}</p>
      ) : null}
    </div>
  );
}

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
        <RemovalPreview preview={previewQuery.data} name={memberName} subject={subject} />
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
