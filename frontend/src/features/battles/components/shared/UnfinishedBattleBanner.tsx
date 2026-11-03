import { Link } from "react-router-dom";

import { useOpenCampaignBattles } from "@/features/battles/hooks/useOpenCampaignBattles";
import type { BattleState } from "@/features/battles/types/battle-types";
import { idleLabel } from "@/features/battles/utils/battle-timing";
import { yourOpenBattles } from "@/features/battles/utils/open-battles";
import { cn } from "@/lib/utils";

/**
 * Your unfinished battle that needs you most (the rejoin banner's pick), other than
 * `excludeBattleId`.
 */
export function findUnfinishedBattle(battles: BattleState[], excludeBattleId?: number) {
  return yourOpenBattles(battles, excludeBattleId)[0]?.state ?? null;
}

/** "invitation", "prebattle", "active" or "postbattle": where you carry on. */
const phaseOf = ({ battle, viewer }: BattleState) =>
  battle.status === "inviting" ? "invitation" : (viewer?.page ?? battle.status);

/**
 * Your unfinished battle, with a way back (BATL-NEW-01): "You have an unfinished battle: #40,
 * postbattle, idle 6 days. Go to it". From the open battles list's `viewer`; the link opens the
 * page where you carry on. Shown on an invitation (its page and the bell's card), where the
 * rejoin banner is not.
 */
export default function UnfinishedBattleBanner({
  campaignId,
  excludeBattleId,
  onGo,
  className,
}: {
  campaignId: number;
  /** The battle the page is about already (an invitation's own battle). */
  excludeBattleId?: number;
  /** Called as the link is followed (e.g. to close a menu). */
  onGo?: () => void;
  className?: string;
}) {
  const { data } = useOpenCampaignBattles(campaignId);
  const unfinished = findUnfinishedBattle(data ?? [], excludeBattleId);
  if (!unfinished?.viewer?.page) {
    return null;
  }
  const { battle } = unfinished;
  const details = [`#${battle.id}`, phaseOf(unfinished), idleLabel(battle.last_activity_at)]
    .filter(Boolean)
    .join(", ");
  return (
    <p
      role="status"
      className={cn(
        "border border-accent-line bg-accent-soft px-3 py-2 text-sm text-accent-hi",
        className
      )}
    >
      You have an unfinished battle: {details}.{" "}
      <Link
        to={`/campaigns/${battle.campaign_id}/battles/${battle.id}/${unfinished.viewer.page}`}
        onClick={onGo}
        className="font-semibold text-ink underline underline-offset-2"
      >
        Go to it
      </Link>
    </p>
  );
}
