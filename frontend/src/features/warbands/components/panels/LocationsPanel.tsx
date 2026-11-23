import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { SidePanel } from "@/components/ui/side-panel";
import LocationTree from "@/features/locations/components/LocationTree";

import type { WarbandHero } from "../../types/warband-types";

type LocationsPanelProps = {
  campaignId: number;
  /** Your warband: Visit sends its heroes. Without one (or `canEdit`), the panel only reads. */
  warbandId: number;
  heroes: WarbandHero[];
  canEdit: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Opens searched for this (Explore's "Read and roll" names the location it found). */
  initialSearch?: string;
};

/**
 * The warband page's Trade Locations panel: the campaign's location groups to read, and Visit to send
 * your heroes. It never edits them (William, 7 Nov 2026: "shouldn't be able to edit locations in
 * the location sidebar within warband"); Go to page opens the campaign's Trade Locations page, where
 * those with `manage_locations` add, edit and remove them.
 */
export default function LocationsPanel(props: LocationsPanelProps) {
  const { campaignId } = props;
  const visit =
    props.canEdit && props.warbandId ? { warbandId: props.warbandId, heroes: props.heroes } : null;

  return (
    <SidePanel
      open={props.open}
      onOpenChange={props.onOpenChange}
      kicker="Campaign"
      title="Trade Locations"
    >
      <Button asChild variant="secondary" className="self-start">
        <Link to={`/campaigns/${campaignId}/locations`}>Go to page</Link>
      </Button>
      <LocationTree
        campaignId={campaignId}
        canManage={false}
        visit={visit}
        enabled={props.open}
        initialSearch={props.initialSearch}
      />
    </SidePanel>
  );
}
