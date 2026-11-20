import type { SalePricing } from "../../hooks/warband/useResourceSaleNumbers";
import type {
  HenchmenGroup,
  Warband,
  WarbandHero,
  WarbandHireling,
  WarbandPlot,
} from "../../types/warband-types";
import WarbandPlotSection from "../plot/WarbandPlotSection";
import WarbandResources from "./WarbandResources";
import WarbandStats from "./WarbandStats";
import { WARBAND_INFO } from "./warband-layout";

/**
 * The top of the warband page's Roster tab (William, 20 Nov 2026): the info line (rating, gold,
 * units, record), then the resources, then its campaign points and plot while the campaign has
 * Plots on (`plot` left out: off), each a full-width section of its own.
 */
export default function WarbandInfo({
  campaignId,
  warband,
  plot,
  heroes,
  hirelings,
  henchmenGroups,
  breakdownOpen,
  setBreakdownOpen,
  canEdit,
  pricing,
}: {
  campaignId: number;
  warband: Warband;
  /** The plot it follows, from the sheet (null: none); undefined while the campaign has Plots off. */
  plot?: WarbandPlot | null;
  heroes: WarbandHero[];
  hirelings: WarbandHireling[];
  henchmenGroups: HenchmenGroup[];
  breakdownOpen: boolean;
  setBreakdownOpen: (open: boolean) => void;
  canEdit: boolean;
  pricing: SalePricing;
}) {
  return (
    <div className={WARBAND_INFO}>
      <WarbandStats
        warband={warband}
        heroes={heroes}
        hirelings={hirelings}
        henchmenGroups={henchmenGroups}
        breakdownOpen={breakdownOpen}
        setBreakdownOpen={setBreakdownOpen}
      />
      <WarbandResources
        warbandId={warband.id}
        resources={warband.resources ?? []}
        canEdit={canEdit}
        pricing={pricing}
      />
      {plot === undefined ? null : (
        <WarbandPlotSection
          campaignId={campaignId}
          warbandId={warband.id}
          plot={plot}
          total={warband.campaign_points ?? 0}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}
