import { Link } from "react-router-dom";
import { Swords } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PHASE_ACTION, type YourOpenBattle } from "@/features/battles/utils/open-battles";

/**
 * Your unfinished battle, on every page of the campaign but the battle's own (William: "a
 * permanent banner at the top prompting to rejoin"): where you are, and one button there that
 * says what waits (Rejoin, Back to pre-battle, Answer the invitation, To the Aftermath). With
 * several, the one that needs you most, and "+N more" to the Battles page, which lists them. It
 * can't be dismissed and goes once the battle is done for you.
 */
export default function RejoinBanner({
  campaignId,
  battles,
}: {
  campaignId: number;
  /** Your unfinished battles, the one that needs you most first (`yourOpenBattles`). */
  battles: YourOpenBattle[];
}) {
  const [lead, ...others] = battles;
  if (!lead) {
    return null;
  }
  return (
    <div
      role="status"
      aria-label="Your battle"
      className="campaign-banner mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 border border-accent-line bg-accent-soft px-4 py-2 text-sm text-ink max-[960px]:mt-3"
    >
      <Swords className="h-4 w-4 shrink-0 text-accent-text" aria-hidden="true" />
      <span className="min-w-0 grow basis-48">
        {lead.phase === "invitation" ? "You're invited to a battle" : "You're in a battle"}:{" "}
        <span className="font-semibold text-head">{lead.title}</span>
        {others.length ? (
          <>
            {" "}
            <Link
              to={`/campaigns/${campaignId}/battles`}
              className="font-semibold text-accent-hi underline underline-offset-2"
            >
              +{others.length} more
            </Link>
          </>
        ) : null}
      </span>
      <Button asChild size="sm" className="h-9 text-[13px] max-[960px]:h-10">
        <Link to={lead.href}>{PHASE_ACTION[lead.phase]}</Link>
      </Button>
    </div>
  );
}
