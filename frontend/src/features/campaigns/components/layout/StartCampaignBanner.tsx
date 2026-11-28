import { Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

import { isArchived } from "../../capabilities";
import { useStartCampaign } from "../../hooks/overview/useStartCampaign";
import type { CampaignSummary } from "../../types/campaign-types";
import CampaignNotice from "./CampaignNotice";

/**
 * Start the campaign, heading the overview on a phone and the web while it hasn't begun, for
 * those who may start it (`capabilities.start`; William, 28 Nov 2026: "no way to start campaign
 * on mobile it seems, can we add it to the campaign page"). Its button opens the confirm; once
 * started it goes.
 */
export default function StartCampaignBanner({ campaign }: { campaign: CampaignSummary }) {
  const starting = useStartCampaign(campaign);
  if (!starting.canStartCampaign || starting.isUnderway || isArchived(campaign)) {
    return null;
  }
  return (
    <>
      <CampaignNotice
        look="page"
        icon={Play}
        kicker="Not started"
        action={
          <Button
            size="sm"
            className="h-9 text-[13px] max-[960px]:h-10"
            onClick={() => starting.setIsStartOpen(true)}
          >
            Start the campaign
          </Button>
        }
      >
        Not started yet.
      </CampaignNotice>
      <ConfirmDialog
        open={starting.isStartOpen}
        onOpenChange={starting.setIsStartOpen}
        title="Start the campaign"
        description="Battles count towards it from now on."
        confirmText={starting.isStarting ? "Starting…" : "Start the campaign"}
        confirmVariant="primary"
        isConfirming={starting.isStarting}
        error={starting.startError}
        onConfirm={() => void starting.handleStartCampaign()}
      />
    </>
  );
}
