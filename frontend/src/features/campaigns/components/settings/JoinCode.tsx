import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { getErrorMessage } from "@/lib/get-error-message";
import { cn } from "@/lib/utils";

import { regenerateJoinCode } from "../../api/campaigns-api";
import { useSetCampaign } from "../../hooks/useCampaignQuery";
import type { CampaignSummary } from "../../types/campaign-types";
import { CAPTION } from "./settings-ui";

/**
 * The join code, shown to every member (decision 1b), with Copy; owners and admins can give the
 * campaign a new one (`regenerate_join_code`). The old code stops working at once, which is how a
 * removed player is kept out.
 */
export default function JoinCode({
  campaign,
  canRegenerate,
  className,
}: {
  campaign: CampaignSummary;
  canRegenerate: boolean;
  className?: string;
}) {
  const setCampaign = useSetCampaign(campaign.id);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(campaign.join_code);
      toast.success("Join code copied.");
    } catch {
      toast.error("Couldn't copy it; select the code instead.");
    }
  };
  const regenerate = async () => {
    setBusy(true);
    setError("");
    try {
      setCampaign(await regenerateJoinCode(campaign.id));
      setConfirming(false);
      toast.success("The campaign has a new join code.");
    } catch (failure) {
      setError(getErrorMessage(failure, "Couldn't make a new join code."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <div className="flex flex-col gap-0.5">
        <span className={CAPTION}>Join code</span>
        <span className="select-all font-mono text-xl font-bold tracking-[0.18em] text-head">
          {campaign.join_code}
        </span>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={() => void copy()}>
          Copy
        </Button>
        {canRegenerate ? (
          <Button size="sm" variant="secondary" onClick={() => setConfirming(true)}>
            New code
          </Button>
        ) : null}
      </div>
      <ConfirmDialog
        open={confirming}
        onOpenChange={(open) => {
          setConfirming(open);
          if (!open) setError("");
        }}
        title="New join code"
        description={
          <div className="flex flex-col gap-2">
            <p className="m-0 text-ink">Give the campaign a new join code?</p>
            <p className="m-0">
              The old code, <span className="font-mono text-ink">{campaign.join_code}</span>, stops
              working at once. Anyone who hasn&apos;t joined yet needs the new one, and a removed
              player can&apos;t use the old one to come back.
            </p>
          </div>
        }
        error={error}
        confirmText={busy ? "Making a new code…" : "Make a new code"}
        confirmVariant="primary"
        isConfirming={busy}
        onConfirm={() => void regenerate()}
      />
    </div>
  );
}
