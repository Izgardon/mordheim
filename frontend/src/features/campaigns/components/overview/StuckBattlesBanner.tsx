import { Link } from "react-router-dom";
import { Hourglass } from "lucide-react";

import { useCampaignActiveBattles } from "../../api/campaign-queries";
import { stuckBattlesSummary } from "../settings/active-battle-labels";

/** Where Review goes: Settings → Campaign, scrolled to Active Battles. */
export const activeBattlesPath = (campaignId: number) =>
  `/campaigns/${campaignId}/settings?tab=campaign&section=active-battles`;

type StuckBattlesBannerProps = {
  campaignId: number;
  /** `capabilities.manage_battles`: only battle managers see it, or read the list for it. */
  enabled: boolean;
};

/**
 * "1 battle idle for 5 days: Review" on the overview (decision 7, CAMP-NEW-05), for those who
 * manage battles, when any open battle has been idle past the server's 24 h.
 */
export default function StuckBattlesBanner({ campaignId, enabled }: StuckBattlesBannerProps) {
  const { data } = useCampaignActiveBattles(campaignId, { enabled });
  const summary = enabled && data ? stuckBattlesSummary(data) : null;
  if (!summary) {
    return null;
  }
  return (
    <div
      role="status"
      className="mx-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-2xl border border-amber-500/40 bg-amber-950/30 px-4 py-2 text-center text-sm text-amber-100 sm:mx-0"
    >
      <Hourglass className="h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
      <span>{`${summary}:`}</span>
      <Link
        to={activeBattlesPath(campaignId)}
        className="font-semibold text-amber-200 underline underline-offset-2 hover:text-amber-50"
      >
        Review
      </Link>
    </div>
  );
}
