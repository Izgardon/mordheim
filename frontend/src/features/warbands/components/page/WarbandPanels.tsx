import { recipientKey } from "@/features/items/store/useStoreBasket";
import StorePanel, { type StoreOpening } from "@/features/items/store/StorePanel";

import type { useUnitActions } from "../../hooks/units/useUnitActions";
import type {
  HenchmenGroup,
  Warband,
  WarbandHero,
  WarbandHireling,
  WarbandItemSummary,
} from "../../types/warband-types";
import LoadoutPanel from "../panels/LoadoutPanel";
import LocationsPanel from "../panels/LocationsPanel";
import StashPanel from "../panels/StashPanel";
import { unitName, type RosterUnit } from "../roster/unit-view";
import type { WarbandPanel } from "./WarbandHeader";

/** The store opened for a unit (its loadout, Buy again): it comes first, "Buying for <name>". */
export const storeFor = (entry: RosterUnit, again?: StoreOpening["again"]): StoreOpening => ({
  forUnit: { key: recipientKey(entry.kind, entry.unit.id), name: unitName(entry.unit) },
  again: again ?? null,
});

type WarbandPanelsProps = {
  campaignId: number;
  warband: Warband;
  heroes: WarbandHero[];
  henchmenGroups: HenchmenGroup[];
  hirelings: WarbandHireling[];
  units: RosterUnit[];
  canEdit: boolean;
  canManageItems: boolean;
  panel: WarbandPanel | null;
  setPanel: (panel: WarbandPanel | null) => void;
  loadoutFor: RosterUnit | null;
  setLoadoutFor: (entry: RosterUnit | null) => void;
  store: StoreOpening;
  openStore: (opening: StoreOpening) => void;
  actions: ReturnType<typeof useUnitActions>;
};

/** The warband page's panels (design E): a unit's loadout, the stash, the store and locations. */
export default function WarbandPanels(props: WarbandPanelsProps) {
  const { campaignId, warband, units, actions, loadoutFor } = props;
  const sellFromStash = (item: WarbandItemSummary) =>
    actions.sellItem(null, item.id, item.suggested_sale_price ?? 0);
  const current = loadoutFor
    ? (units.find((u) => u.kind === loadoutFor.kind && u.unit.id === loadoutFor.unit.id) ?? null)
    : null;

  return (
    <>
      <LoadoutPanel
        campaignId={campaignId}
        warbandId={warband.id}
        entry={current}
        onOpenChange={(open) => (open ? null : props.setLoadoutFor(null))}
        canEdit={props.canManageItems}
        units={units}
        onMove={actions.moveItem}
        onSellFromStash={sellFromStash}
        onOpenStore={() => {
          props.setLoadoutFor(null);
          if (current) props.openStore(storeFor(current));
        }}
      />
      <StashPanel
        campaignId={campaignId}
        warbandId={warband.id}
        open={props.panel === "stash"}
        onOpenChange={(open) => props.setPanel(open ? "stash" : null)}
        canEdit={props.canManageItems}
        units={units}
        onMove={(itemId, to) => actions.moveItem(null, itemId, to)}
        onSell={sellFromStash}
      />
      <StorePanel
        open={props.panel === "store"}
        onOpenChange={(open) => props.setPanel(open ? "store" : null)}
        campaignId={campaignId}
        warband={warband}
        heroes={props.heroes}
        henchmenGroups={props.henchmenGroups}
        hirelings={props.hirelings}
        canBuy={props.canManageItems}
        opening={props.store}
      />
      <LocationsPanel
        campaignId={campaignId}
        warbandId={warband.id}
        heroes={props.heroes}
        canEdit={props.canEdit}
        open={props.panel === "locations"}
        onOpenChange={(open) => props.setPanel(open ? "locations" : null)}
      />
    </>
  );
}
