import { Button } from "@/components/ui/button";
import { CardBackground } from "@/components/ui/card-background";
import type { BattleParticipant } from "@/features/battles/types/battle-types";

/**
 * Waiting for others (BATL-NEW-08): shown instead of the postbattle once yours is finalised or
 * skipped, until the last player finishes and the battle ends. Says who it is waiting for; the
 * status strip above shows how long they've been idle.
 */
export default function PostbattleWaitingPanel({
  participants,
  currentUserId,
  onOpenWarband,
  onOpenCampaign,
}: {
  participants: BattleParticipant[];
  currentUserId: number | undefined;
  onOpenWarband: () => void;
  onOpenCampaign: () => void;
}) {
  const waitingFor = participants
    .filter(
      (participant) =>
        participant.user.id !== currentUserId && participant.status === "finished_battle"
    )
    .map((participant) => `${participant.user.label} (${participant.warband.name})`);
  return (
    <section aria-labelledby="postbattle-waiting-title">
      <CardBackground className="battle-card space-y-3 p-4 sm:p-5">
        <p id="postbattle-waiting-title" className="battle-section-title">
          Waiting for others
        </p>
        <p className="text-sm text-foreground">
          Your postbattle is done. The battle ends, and wins and losses are recorded, once everyone
          has finished theirs.
        </p>
        {waitingFor.length > 0 ? (
          <p className="text-sm text-foreground">Still in postbattle: {waitingFor.join(", ")}.</p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          You can leave this page; nothing here needs you any more.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" className="h-11" onClick={onOpenWarband}>
            Go to your warband
          </Button>
          <Button type="button" variant="secondary" className="h-11" onClick={onOpenCampaign}>
            Back to the campaign
          </Button>
        </div>
      </CardBackground>
    </section>
  );
}
