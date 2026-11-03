import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Flag } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ModalSheet } from "@/components/ui/modal-sheet";
import { MoreMenu, type MoreMenuEntry } from "@/components/ui/more-menu";
import type { YourOpenBattle } from "@/features/battles/utils/open-battles";
import { cn } from "@/lib/utils";

import { campaignCapabilities, isArchived } from "../../capabilities";
import { useStartCampaign } from "../../hooks/overview/useStartCampaign";
import type { CampaignSummary } from "../../types/campaign-types";
import BattleButton from "./BattleButton";

type OverviewHeaderProps = {
  campaign: CampaignSummary;
  isMobile: boolean;
  /** Your battle that needs you most: the Start battle button goes there instead. */
  battle: YourOpenBattle | null;
  onStartBattle: () => void;
  onReportResult: () => void;
  /** Export: the campaign's standings, battles and chronicle as a file. */
  onExport: () => void;
};

/** The invite: the campaign's join code, to copy and send. */
function InviteDialog({
  campaign,
  open,
  onClose,
}: {
  campaign: CampaignSummary;
  open: boolean;
  onClose: () => void;
}) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(campaign.join_code);
      toast.success("Join code copied.");
    } catch {
      toast.error("Couldn't copy it; select the code instead.");
    }
  };
  return (
    <ModalSheet
      open={open}
      onOpenChange={(next) => (next ? null : onClose())}
      kicker={campaign.name}
      title="Invite a player"
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" className="min-h-12" onClick={onClose}>
            Done
          </Button>
          <Button className="min-h-12" onClick={() => void copy()}>
            Copy the code
          </Button>
        </div>
      }
    >
      <p className="m-0 select-all border border-accent-line bg-page px-4 py-3 text-center font-mono text-2xl font-bold tracking-[0.2em] text-head">
        {campaign.join_code}
      </p>
      <p className="m-0 text-xs text-muted-foreground">
        {campaign.player_count} of {campaign.max_players} places taken.
      </p>
    </ModalSheet>
  );
}

/**
 * The overview's header (design E): the campaign's name, Start battle and Report a result (the
 * same size), and the ⋯ menu: Invite a player, Campaign settings, Export, and Start the campaign
 * for those who may while it hasn't begun. While you have a battle, Start battle takes you there
 * (Rejoin and the like) and the menu gains Start another battle, unless you are fighting it. An
 * archived campaign takes no new battles.
 */
export default function OverviewHeader(props: OverviewHeaderProps) {
  const { campaign, isMobile } = props;
  const navigate = useNavigate();
  const starting = useStartCampaign(campaign);
  const [inviteOpen, setInviteOpen] = useState(false);
  const archived = isArchived(campaign);
  const menu: MoreMenuEntry[] = [
    ...(archived ? [] : [{ label: "Invite a player", onSelect: () => setInviteOpen(true) }]),
    // a player may be in several pre-battles and post-games (warned), but fight only one: Start
    // battle stays in reach until he fights (his fight comes first: `yourOpenBattles`)
    ...(props.battle && props.battle.phase !== "fight" && !archived
      ? [{ label: "Start another battle", onSelect: props.onStartBattle }]
      : []),
    { label: "Campaign settings", onSelect: () => navigate(`/campaigns/${campaign.id}/settings`) },
    { label: "Export the campaign", onSelect: props.onExport },
    ...(starting.canStartCampaign && !starting.isUnderway && !archived
      ? [{ label: "Start the campaign", onSelect: () => starting.setIsStartOpen(true) }]
      : []),
  ];
  const buttons = archived ? null : (
    <>
      <BattleButton
        battle={props.battle}
        onStartBattle={props.onStartBattle}
        icon={!isMobile}
        className={isMobile ? "min-h-12 px-3" : "min-w-[168px]"}
      />
      <Button
        size="lg"
        variant="secondary"
        className={isMobile ? "min-h-12" : "min-w-[168px]"}
        onClick={props.onReportResult}
      >
        {isMobile ? null : <Flag aria-hidden="true" />}
        Report a result
      </Button>
    </>
  );

  return (
    <>
      {isMobile ? (
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px] gap-2">
          {buttons}
          <MoreMenu label="More campaign actions" entries={menu} className="h-12 w-11" />
        </div>
      ) : (
        <header className="flex flex-wrap items-end justify-between gap-5">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-faint">
              Campaign · {campaign.player_count}{" "}
              {campaign.player_count === 1 ? "player" : "players"}
            </span>
            <h1 className="m-0 font-display text-[40px] font-semibold leading-tight text-head">
              {campaign.name}
            </h1>
          </div>
          <div className={cn("flex flex-wrap gap-2")}>
            {buttons}
            <MoreMenu label="More campaign actions" entries={menu} />
          </div>
        </header>
      )}
      <InviteDialog campaign={campaign} open={inviteOpen} onClose={() => setInviteOpen(false)} />
      {campaignCapabilities(campaign).start ? (
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
      ) : null}
    </>
  );
}
