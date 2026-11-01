import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Shield } from "lucide-react";

import { Button } from "@/components/ui/button";
import { myWarbandQuery } from "@/features/warbands/api/warband-queries";

import { isArchived } from "../../capabilities";
import type { CampaignSummary } from "../../types/campaign-types";

/** The raise-a-warband page: the warband page while you have none. */
const isRaisePage = (pathname: string, campaignId: number) =>
  pathname.replace(/\/+$/, "") === `/campaigns/${campaignId}/warband`;

/**
 * Every page of a campaign you have no warband in says so (William, 1 Nov 2026), with the way to
 * raise one. It can't be dismissed and goes once the warband stands. Not on the raise page
 * itself, nor in an archived campaign (nothing can be raised there). It reads the layout's own
 * query for your warband, so it costs no request.
 */
export default function NoWarbandBanner({
  campaign,
  pathname,
}: {
  campaign: CampaignSummary;
  pathname: string;
}) {
  const mine = useQuery(myWarbandQuery(campaign.id));
  if (mine.data !== null || isArchived(campaign) || isRaisePage(pathname, campaign.id)) {
    return null;
  }
  return (
    <div
      role="status"
      className="campaign-banner mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 border border-accent-line bg-accent-soft px-4 py-2 text-sm text-ink max-[960px]:mt-3"
    >
      <Shield className="h-4 w-4 shrink-0 text-accent-text" aria-hidden="true" />
      <span className="min-w-0 grow basis-48">You have no warband in this campaign.</span>
      <Button asChild size="sm" className="h-9 text-[13px] max-[960px]:h-10">
        <Link to={`/campaigns/${campaign.id}/warband`}>Raise your warband</Link>
      </Button>
    </div>
  );
}
