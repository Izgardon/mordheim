import { useOutletContext, useSearchParams } from "react-router-dom";

import EncampmentTree from "@/features/encampments/components/EncampmentTree";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";

import { campaignCapabilities } from "../capabilities";
import type { CampaignLayoutContext } from "./CampaignLayout";

/**
 * The campaign's Encampments page (`/campaigns/:id/encampments`; William, 24 Nov 2026): how they
 * are held, then the groups of places its warbands hold, each encampment saying who holds it.
 * Those with `manage_encampments` add, edit and remove groups and encampments; a warband's player
 * takes one, and the holder's razes it or gives it up. `?open=` opens one (the warband sheet's
 * links).
 */
export default function Encampments() {
  const { campaign } = useOutletContext<CampaignLayoutContext>();
  const isMobile = useMediaQuery("(max-width: 960px)");
  const [params] = useSearchParams();
  if (!campaign)
    return <p className="text-sm text-muted-foreground">No record of this campaign.</p>;
  const capabilities = campaignCapabilities(campaign);
  const opened = Number(params.get("open"));

  return (
    <div className={cn("flex flex-col", isMobile ? "gap-3 pb-6" : "gap-6 pb-14")}>
      {isMobile ? null : (
        <header className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-faint">
            Campaign
          </span>
          <h1 className="m-0 font-display text-[40px] font-semibold leading-tight text-head">
            Encampments
          </h1>
        </header>
      )}
      {campaign.enable_encampments ? (
        <EncampmentTree
          campaignId={campaign.id}
          canManage={capabilities.manage_encampments}
          canManageRules={capabilities.manage_campaign_rules}
          openId={Number.isInteger(opened) && opened > 0 ? opened : null}
          isMobile={isMobile}
        />
      ) : (
        <p className="m-0 border border-border bg-surface px-4 py-5 text-sm text-text2">
          Encampments are switched off for this campaign.
        </p>
      )}
    </div>
  );
}
