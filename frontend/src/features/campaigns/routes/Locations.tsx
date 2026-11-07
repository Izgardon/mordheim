import { useOutletContext } from "react-router-dom";

import LocationsList from "@/features/warbands/components/panels/LocationsList";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";

import { campaignCapabilities } from "../capabilities";
import type { CampaignLayoutContext } from "./CampaignLayout";

/**
 * The campaign's Locations page (`/campaigns/:id/locations`, the nav's Locations): where those with
 * `manage_locations` add, edit and remove the locations (William, 7 Nov 2026: "shouldn't be able
 * to edit locations in the location sidebar within warband"); every member reads them here too,
 * two to a row on the web. The warband page's Locations panel rolls on them and sends heroes.
 * Shown while the campaign has Locations switched on.
 */
export default function Locations() {
  const { campaign } = useOutletContext<CampaignLayoutContext>();
  const isMobile = useMediaQuery("(max-width: 960px)");
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
            Locations
          </h1>
        </header>
      )}
      {campaign.enable_locations ? (
        <div className="flex w-full flex-col gap-3">
          <LocationsList
            campaignId={campaign.id}
            warbandId={0}
            heroes={[]}
            canSend={false}
            canManage={campaignCapabilities(campaign).manage_locations}
            enabled
            page
          />
        </div>
      ) : (
        <p className="m-0 border border-border bg-surface px-4 py-5 text-sm text-text2">
          Locations are switched off for this campaign.
        </p>
      )}
    </div>
  );
}
