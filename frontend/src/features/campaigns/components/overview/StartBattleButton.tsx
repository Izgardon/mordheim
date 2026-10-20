import { useState } from "react";

import { Button } from "@components/button";
import { ConfirmDialog } from "@components/confirm-dialog";
import { cn } from "@/lib/utils";

import StartBattleDialog from "./StartBattleDialog";

import type { CampaignPlayer } from "../../types/campaign-types";

type StartBattleButtonProps = {
  campaignId: number;
  creatorUserId: number;
  players: CampaignPlayer[];
  campaignStarted: boolean;
  disabled?: boolean;
  className?: string;
  onBattleCreated: () => void;
};

/** The question a click on the greyed-out button asks before the start (decision 3). */
export const NOT_STARTED_QUESTION = "The campaign hasn't started yet. Start a battle anyway?";

/**
 * Start battle, and the dialog it opens. Before the campaign's start it is greyed out but still
 * clickable (a guide, not a gatekeeper): it asks first, and the server answers the battle with a
 * `campaign_not_started` warning, which the dialog shows as a toast.
 */
export default function StartBattleButton({
  campaignId,
  creatorUserId,
  players,
  campaignStarted,
  disabled = false,
  className,
  onBattleCreated,
}: StartBattleButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isWarningOpen, setIsWarningOpen] = useState(false);

  return (
    <>
      <Button
        variant="toolbar"
        size="sm"
        disabled={disabled}
        onClick={() => (campaignStarted ? setIsDialogOpen(true) : setIsWarningOpen(true))}
        className={cn(className, !campaignStarted && "opacity-60 grayscale")}
      >
        Start battle
      </Button>
      <ConfirmDialog
        open={isWarningOpen}
        onOpenChange={setIsWarningOpen}
        title="Campaign not started"
        description={NOT_STARTED_QUESTION}
        confirmText="Start a battle anyway"
        confirmVariant="secondary"
        onConfirm={() => {
          setIsWarningOpen(false);
          setIsDialogOpen(true);
        }}
      />
      <StartBattleDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        campaignId={campaignId}
        creatorUserId={creatorUserId}
        players={players}
        onBattleCreated={onBattleCreated}
      />
    </>
  );
}
