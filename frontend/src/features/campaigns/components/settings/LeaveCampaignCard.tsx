import { Button } from "@components/button";
import { CardBackground } from "@components/card-background";
import { ConfirmDialog } from "@components/confirm-dialog";
import { getErrorMessage } from "@/lib/get-error-message";
import { cn } from "@/lib/utils";

import { leaveMode, useLeaveCampaign } from "../../hooks/settings/useLeaveCampaign";
import RemovalPreview, { ownVoice } from "./RemovalPreview";

import type { CampaignSummary } from "../../types/campaign-types";

const HAND_OVER_FIRST =
  "Hand ownership to an admin first: Settings, Campaign, then Make owner on an admin's row.";

/**
 * Settings → Personal → Leave campaign (decision 4, CAMP-NEW-03). Players and admins leave with
 * removal's clean-up; the owner alone archives the campaign by leaving; the owner with company
 * sees Leave greyed out until they hand ownership over.
 */
export default function LeaveCampaignCard({ campaign }: { campaign: CampaignSummary }) {
  const mode = leaveMode(campaign);
  const leaving = useLeaveCampaign(campaign);
  if (!mode) {
    return null;
  }
  const action = mode === "archive" ? "Leave (archives the campaign)" : "Leave campaign";
  const blocked = mode === "hand_over_first";

  return (
    <section aria-label="Leave campaign">
      <CardBackground className="space-y-3 bg-[rgba(12,9,6,0.92)] p-3 sm:p-6">
        <h3 className="text-lg font-semibold text-foreground">Leave campaign</h3>
        <p className="text-sm text-muted-foreground">
          {blocked
            ? HAND_OVER_FIRST
            : mode === "archive"
              ? "You're the only member, so leaving archives the campaign. You stay its owner and can restore it."
              : "Your open battles and trades close. Your warband is kept and comes back if you rejoin with the join code."}
        </p>
        <Button
          variant="destructive"
          className={cn(blocked && "opacity-50 grayscale")}
          aria-disabled={blocked ? "true" : undefined}
          title={blocked ? "Hand ownership to an admin first" : undefined}
          onClick={blocked ? undefined : leaving.openLeave}
        >
          {action}
        </Button>
      </CardBackground>
      <ConfirmDialog
        open={leaving.open}
        onOpenChange={(open) => {
          if (!open) leaving.closeLeave();
        }}
        title="Leave campaign"
        description={
          <div className="space-y-3">
            <p>{`Leave ${campaign.name}?`}</p>
            {mode === "archive" ? (
              <p>
                You&apos;re the only member, so leaving archives it: it becomes read-only, and you
                stay its owner, so you can restore it from its Settings.
              </p>
            ) : null}
            {leaving.preview.isPending ? (
              <p className="text-sm text-muted-foreground">Checking what this closes...</p>
            ) : leaving.preview.isError ? (
              <p className="text-sm text-red-600">
                {getErrorMessage(leaving.preview.error, "Couldn't check what this closes.")}
              </p>
            ) : (
              <RemovalPreview preview={leaving.preview.data} voice={ownVoice} />
            )}
            {leaving.error ? <p className="text-sm text-red-600">{leaving.error}</p> : null}
          </div>
        }
        confirmText={leaving.isLeaving ? "Leaving..." : action}
        confirmDisabled={leaving.isLeaving || leaving.preview.isPending}
        isConfirming={leaving.isLeaving}
        onConfirm={() => void leaving.leave()}
        onCancel={leaving.closeLeave}
      />
    </section>
  );
}
