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
      className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 border border-accent-line bg-accent-soft px-4 py-3 text-sm text-ink sm:mx-0"
    >
      <Archive className="h-4 w-4 shrink-0 text-accent-text" aria-hidden="true" />
      <span className="min-w-0 grow basis-56">
        This campaign is archived: read-only for everyone. Nothing in it can change until its owner
        restores it.
      </span>
      {campaignCapabilities(campaign).restore ? (
        <Link
          to={`/campaigns/${campaign.id}/settings?section=archive`}
          className="font-semibold text-accent-hi underline underline-offset-2"
        >
          Restore it in Settings
        </Link>
      ) : null}
    </div>
  );
}
