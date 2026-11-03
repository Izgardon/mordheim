import { Link } from "react-router-dom";
import { Swords } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PHASE_ACTION, type YourOpenBattle } from "@/features/battles/utils/open-battles";

import CampaignNotice, { type NoticeLook } from "./CampaignNotice";

/**
 * Your unfinished battle, on every page of the campaign but the overview (whose Start battle reads
 * Rejoin) and the battle's own (William: "a permanent banner at the top prompting to rejoin"):
 * where you are, and one button there that says what waits (Rejoin, Back to pre-battle, Answer
 * the invitation, To the Aftermath). With several, the one that needs you most, and "+N more" to
 * the Battles page, which lists them. It goes once the battle is done for you. In the web bar;
 * in the page's flow on a phone.
 */
export default function RejoinBanner({
  campaignId,
  battles,
  look = "page",
}: {
  campaignId: number;
  /** Your unfinished battles, the one that needs you most first (`yourOpenBattles`). */
  battles: YourOpenBattle[];
  look?: NoticeLook;
}) {
  const [lead, ...others] = battles;
  if (!lead) {
    return null;
  }
  return (
    <CampaignNotice
      look={look}
      label="Your battle"
      icon={Swords}
      action={
        <Button asChild size="sm" className="h-9 text-[13px] max-[960px]:h-10">
          <Link to={lead.href}>{PHASE_ACTION[lead.phase]}</Link>
        </Button>
      }
    >
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
    </CampaignNotice>
  );
}
