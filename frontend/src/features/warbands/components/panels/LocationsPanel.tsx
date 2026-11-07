import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { SidePanel } from "@/components/ui/side-panel";
import { useCampaignCapabilities } from "@/features/campaigns/capabilities";

import type { WarbandHero } from "../../types/warband-types";
import LocationsList from "./LocationsList";

type LocationsPanelProps = {
  campaignId: number;
  /** Your warband: Send a hero logs to it. Without one (or `canEdit`), the panel only reads. */
  warbandId: number;
  heroes: WarbandHero[];
  canEdit: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Opens searched for this (Explore's "Read and roll" names the location it found). */
  initialSearch?: string;
};

/**
 * The warband page's Locations panel: the campaign's locations to read, roll and Send a hero to.
 * It never edits them (William, 7 Nov 2026: "shouldn't be able to edit locations in the location
 * sidebar within warband"); with `manage_locations`, Edit locations goes to the campaign's
 * Locations page, where they are added, edited and removed.
 */
export default function LocationsPanel(props: LocationsPanelProps) {
  const { campaignId } = props;
  const canManage = useCampaignCapabilities(campaignId).manage_locations;

  return (
    <SidePanel
      open={props.open}
      onOpenChange={props.onOpenChange}
      kicker="Campaign"
      title="Locations"
    >
      {canManage ? (
        <Button asChild variant="secondary" className="self-start">
          <Link to={`/campaigns/${campaignId}/locations`}>Edit locations</Link>
        </Button>
      ) : null}
      <LocationsList
        campaignId={campaignId}
        warbandId={props.warbandId}
        heroes={props.heroes}
        canSend={props.canEdit}
        canManage={false}
        enabled={props.open}
        initialSearch={props.initialSearch}
      />
    </SidePanel>
  );
}
