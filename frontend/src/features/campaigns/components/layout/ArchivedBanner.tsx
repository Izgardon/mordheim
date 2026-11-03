import { Link } from "react-router-dom";
import { Archive } from "lucide-react";

import { campaignCapabilities } from "../../capabilities";

import type { CampaignSummary } from "../../types/campaign-types";
import CampaignNotice, { type NoticeLook } from "./CampaignNotice";

/**
 * Every page of an archived campaign says it is read-only (decision 5); its owner gets the way to
 * restore it. In the web bar (in the overview's page, whose bar holds Between battles); in the
 * page's flow on a phone.
 */
export default function ArchivedBanner({
  campaign,
  look = "page",
}: {
  campaign: CampaignSummary;
  look?: NoticeLook;
}) {
  if (!campaign.archived_at) {
    return null;
  }
  return (
    <CampaignNotice
      look={look}
      icon={Archive}
      kicker="Archived"
      className={look === "page" ? "gap-y-1 py-3" : undefined}
      action={
        campaignCapabilities(campaign).restore ? (
          <Link
            to={`/campaigns/${campaign.id}/settings?section=archive`}
            className="font-semibold text-accent-hi underline underline-offset-2"
          >
            Restore it in Settings
          </Link>
        ) : null
      }
    >
      {look === "bar"
        ? "Read-only for everyone"
        : "This campaign is archived: read-only for everyone."}
    </CampaignNotice>
  );
}
