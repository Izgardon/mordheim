import { Link } from "react-router-dom";
import { Hourglass } from "lucide-react";

import { useCampaignActiveBattles } from "../../api/campaign-queries";
import PendingResults from "./PendingResults";

/** "2 battles idle for over a day: Review", for battle managers (decision 7, CAMP-NEW-05). */
function StuckBattles({ campaignId, enabled }: { campaignId: number; enabled: boolean }) {
  const { data } = useCampaignActiveBattles(campaignId, { enabled });
  const stuck = enabled ? (data ?? []).filter((entry) => entry.stuck).length : 0;
  if (!stuck) return null;
  return (
    <p
      role="status"
      className="m-0 flex flex-wrap items-center gap-2 border border-accent-line bg-accent-soft px-3 py-2 text-sm text-accent-hi"
    >
      <Hourglass className="h-4 w-4 shrink-0" aria-hidden="true" />
      {stuck} {stuck === 1 ? "battle has" : "battles have"} been idle for over a day.
      <Link
        to={`/campaigns/${campaignId}/settings?section=battles`}
        className="font-semibold text-ink underline underline-offset-2"
      >
        Review
      </Link>
    </p>
  );
}

/**
 * What waits on you, above the overview's sections and the Battles page's: battles stuck for
 * over a day (battle managers) and reported results to answer. Your own unfinished battle is the
 * rejoin banner's.
 */
export default function OverviewNotices({
  campaignId,
  managesBattles,
}: {
  campaignId: number;
  managesBattles: boolean;
}) {
  return (
    <div className="flex flex-col gap-2.5 empty:hidden">
      <StuckBattles campaignId={campaignId} enabled={managesBattles} />
      <PendingResults campaignId={campaignId} />
    </div>
  );
}
