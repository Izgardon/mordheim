import { useState } from "react";

import { Button } from "@components/button";
import { ConfirmDialog } from "@components/confirm-dialog";
import { getErrorMessage } from "@/lib/get-error-message";
import { cn } from "@/lib/utils";

import { regenerateJoinCode } from "../../api/campaigns-api";

import type { CampaignSummary } from "../../types/campaign-types";

type JoinCodeBadgeProps = {
  campaign: CampaignSummary;
  /** Owners and admins may give the campaign a new code (decision 1). */
  canRegenerate: boolean;
  onRegenerated: (campaign: CampaignSummary) => void;
  /** The small version beside the mobile tabs. */
  compact?: boolean;
};

/**
 * The join code in the Settings header, shown to every member (decision 1b). Owners and admins
 * can swap in a new one; the old code stops working at once, which is how a removed player is
 * kept out.
 */
export default function JoinCodeBadge({
  campaign,
  canRegenerate,
  onRegenerated,
  compact = false,
}: JoinCodeBadgeProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [error, setError] = useState("");

  const closeConfirm = (nextOpen: boolean) => {
    setIsConfirmOpen(nextOpen);
    if (!nextOpen) {
      setError("");
    }
  };

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    setError("");
    try {
      onRegenerated(await regenerateJoinCode(campaign.id));
      setIsConfirmOpen(false);
    } catch (errorResponse) {
      setError(getErrorMessage(errorResponse, "Couldn't make a new join code."));
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <div className={cn("flex items-center gap-2", compact ? "gap-1.5" : "gap-3")}>
      <div className={compact ? "text-right" : "flex flex-col items-end"}>
        <p
          className={cn(
            "uppercase tracking-[0.2em] text-muted-foreground",
            compact ? "text-[0.5rem]" : "text-xs"
          )}
        >
          Join Code
        </p>
        <p
          className={cn(
            "font-mono font-semibold text-foreground",
            compact ? "text-[0.65rem]" : "text-sm"
          )}
        >
          {campaign.join_code}
        </p>
      </div>
      {canRegenerate ? (
        <>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className={compact ? "h-7 px-2 text-[0.55rem]" : undefined}
            onClick={() => setIsConfirmOpen(true)}
          >
            New code
          </Button>
          <ConfirmDialog
            open={isConfirmOpen}
            onOpenChange={closeConfirm}
            title="Regenerate join code"
            description={
              <div className="space-y-2">
                <p>Give the campaign a new join code?</p>
                <p>
                  The old code, <span className="font-mono">{campaign.join_code}</span>, stops
                  working at once. Anyone who hasn't joined yet needs the new one, and a removed
                  player can't use the old one to come back.
                </p>
                {error ? <p className="text-sm text-red-600">{error}</p> : null}
              </div>
            }
            confirmText={isRegenerating ? "Regenerating..." : "Regenerate join code"}
            confirmVariant="secondary"
            isConfirming={isRegenerating}
            onConfirm={() => void handleRegenerate()}
          />
        </>
      ) : null}
    </div>
  );
}
