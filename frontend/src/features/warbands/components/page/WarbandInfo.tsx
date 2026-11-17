import type { SalePricing } from "../../hooks/warband/useResourceSaleNumbers";
import type {
  HenchmenGroup,
  Warband,
  WarbandHero,
  WarbandHireling,
} from "../../types/warband-types";
import WarbandResources from "./WarbandResources";
import WarbandStats from "./WarbandStats";
import { WARBAND_INFO } from "./warband-layout";

/** The warband page's info line (rating, gold, units, record) beside its resources (design E). */
export default function WarbandInfo({
  warband,
  heroes,
  hirelings,
  henchmenGroups,
  breakdownOpen,
  setBreakdownOpen,
  canEdit,
  pricing,
}: {
  warband: Warband;
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
    </div>
  );
}
