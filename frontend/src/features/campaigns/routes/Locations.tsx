import { useOutletContext, useSearchParams } from "react-router-dom";

import LocationTree from "@/features/locations/components/LocationTree";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";

import { campaignCapabilities } from "../capabilities";
import type { CampaignLayoutContext } from "./CampaignLayout";

/**
 * The campaign's Trade locations page (`/campaigns/:id/locations`, the nav's Trade locations): its
 * location groups, each opening to its locations (William, 23 Nov 2026). Those with
 * `manage_locations` add, edit and remove them here; every member reads them. The warband page's
 * Trade locations panel sends heroes. `?place=` opens it searched for that location (Search
 * everything's links).
 */
export default function Locations() {
  const { campaign } = useOutletContext<CampaignLayoutContext>();
  const isMobile = useMediaQuery("(max-width: 960px)");
  const [params] = useSearchParams();
  if (!campaign)
    return <p className="text-sm text-muted-foreground">No record of this campaign.</p>;

  return (
    <div className={cn("flex flex-col", isMobile ? "gap-3 pb-6" : "gap-6 pb-14")}>
      {isMobile ? null : (
        <header className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-faint">
            Campaign
          </span>
          <h1 className="m-0 font-display text-[40px] font-semibold leading-tight text-head">
            Trade locations
          </h1>
        </header>
      )}
      {campaign.enable_locations ? (
        <LocationTree
          campaignId={campaign.id}
          canManage={campaignCapabilities(campaign).manage_locations}
          initialSearch={params.get("place") ?? undefined}
        />
      ) : (
        <p className="m-0 border border-border bg-surface px-4 py-5 text-sm text-text2">
          Trade locations are switched off for this campaign.
        </p>
      )}
    </div>
  );
}
