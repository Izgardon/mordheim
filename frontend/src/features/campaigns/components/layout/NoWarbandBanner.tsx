import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Shield } from "lucide-react";

import { Button } from "@/components/ui/button";
import { myWarbandQuery } from "@/features/warbands/api/warband-queries";

import { isArchived } from "../../capabilities";
import type { CampaignSummary } from "../../types/campaign-types";
import CampaignNotice, { type NoticeLook } from "./CampaignNotice";

/** The raise-a-warband page: the warband page while you have none. */
const isRaisePage = (pathname: string, campaignId: number) =>
  pathname.replace(/\/+$/, "") === `/campaigns/${campaignId}/warband`;

/**
 * Whether the page says you have no warband: once your warband has been read and there is none,
 * except on the raise page itself and in an archived campaign (nothing can be raised there). It
 * reads the layout's own query for your warband, so it costs no request.
 */
export function useNeedsWarband(campaign: CampaignSummary, pathname: string) {
  const mine = useQuery(myWarbandQuery(campaign.id));
  return mine.data === null && !isArchived(campaign) && !isRaisePage(pathname, campaign.id);
}

/**
 * Every page of a campaign you have no warband in says so (William, 1 Nov 2026), with the way to
 * raise one. It can't be dismissed and goes once the warband stands. In the web bar (in the
 * overview's page, whose bar holds Between battles); in the page's flow on a phone.
 */
export default function NoWarbandBanner({
  campaign,
  pathname,
  look = "page",
}: {
  campaign: CampaignSummary;
  pathname: string;
  look?: NoticeLook;
}) {
  if (!useNeedsWarband(campaign, pathname)) {
    return null;
  }
  return (
    <CampaignNotice
      look={look}
      icon={Shield}
      action={
        <Button asChild size="sm" className="h-9 text-[13px] max-[960px]:h-10">
          <Link to={`/campaigns/${campaign.id}/warband`}>Raise your warband</Link>
        </Button>
      }
    >
      You have no warband in this campaign.
    </CampaignNotice>
  );
}
