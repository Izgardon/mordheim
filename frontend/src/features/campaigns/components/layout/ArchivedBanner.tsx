import { Link } from "react-router-dom";
import { Archive } from "lucide-react";

import { campaignCapabilities } from "../../capabilities";

import type { CampaignSummary } from "../../types/campaign-types";

/**
 * Every page of an archived campaign says it is read-only (decision 5); its owner gets the way to
 * restore it.
 */
export default function ArchivedBanner({ campaign }: { campaign: CampaignSummary }) {
  if (!campaign.archived_at) {
    return null;
  }
  return (
    <div
      role="status"
      className="mx-2 mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-amber-500/40 bg-amber-950/40 px-4 py-3 text-sm text-amber-100 sm:mx-0"
    >
      <Archive className="h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        This campaign is archived: read-only for everyone. Nothing in it can change until its owner
        restores it.
      </span>
      {campaignCapabilities(campaign).restore ? (
        <Link
          to={`/campaigns/${campaign.id}/settings?tab=campaign`}
          className="font-semibold text-amber-200 underline underline-offset-2 hover:text-amber-50"
        >
          Restore it in Settings
        </Link>
      ) : null}
    </div>
  );
}
