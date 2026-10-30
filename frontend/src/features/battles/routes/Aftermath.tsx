import { Link, Navigate, useOutletContext, useParams } from "react-router-dom";

import AftermathBody from "@/features/battles/components/aftermath/AftermathBody";
import { usePostgameBattle } from "@/features/battles/hooks/usePostgameBattle";
import { campaignCapabilities } from "@/features/campaigns/capabilities";
import type { CampaignLayoutContext } from "@/features/campaigns/routes/CampaignLayout";
import { useMediaQuery } from "@/lib/use-media-query";

/**
 * The Aftermath (design E), today's post-battle route rebuilt: your injuries, experience and
 * exploration after a battle, saved to the postbattle draft as you go and applied at Ready (on
 * the warband page's camp). Only while your post-game is open: before it, or once you are ready,
 * it says where to go instead.
 */
export default function Aftermath() {
  const { id, battleId } = useParams();
  const campaignId = Number(id);
  const { campaign } = useOutletContext<CampaignLayoutContext>();
  const isMobile = useMediaQuery("(max-width: 960px)");
  const battle = usePostgameBattle(
    campaignId,
    Number(battleId),
    campaignCapabilities(campaign).manage_battles
  );
  const { battleState, participant } = battle;
  const warbandPath = `/campaigns/${campaignId}/warband`;

  if (battle.isLoading) return <p className="text-sm text-muted-foreground">Reading the battle…</p>;
  if (battle.error || !battleState) {
    return <p className="text-sm text-danger">{battle.error || "No record of that battle."}</p>;
  }
  if (!participant) return <p className="text-sm text-text2">You weren't in this battle.</p>;
  if (participant.status === "confirmed_postbattle" || battleState.battle.status === "ended") {
    return <Navigate to={warbandPath} replace />;
  }
  if (participant.status !== "finished_battle") {
    return (
      <p className="text-sm text-text2">
        Your aftermath opens once you finish your fight.{" "}
        <Link to={`/campaigns/${campaignId}`} className="font-semibold text-accent-text">
          Back to the campaign
        </Link>
      </p>
    );
  }
  if (battle.rosterError) return <p className="text-sm text-danger">{battle.rosterError}</p>;
  if (!battle.roster) return <p className="text-sm text-muted-foreground">Reading your roster…</p>;

  return (
    <AftermathBody
      campaign={campaign}
      battle={battle}
      battleState={battleState}
      me={participant}
      isMobile={isMobile}
    />
  );
}
