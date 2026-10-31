import { useMemo } from "react";

import { SidePanel } from "@/components/ui/side-panel";
import type {
  HenchmenGroup,
  Warband,
  WarbandHero,
  WarbandHireling,
} from "@/features/warbands/types/warband-types";
import { useMediaQuery } from "@/lib/use-media-query";

import StoreBasket from "./StoreBasket";
import StoreList from "./StoreList";
import { recipientsFor, useStoreBasket } from "./useStoreBasket";
import { buyerOf } from "./store-items";
import { useBuyer } from "./useBuyer";
import { useCampaignQuery } from "@/features/campaigns/hooks/useCampaignQuery";

/** Where the store was opened from: a unit (its loadout, Buy again), maybe with an item to get. */
export type StoreOpening = {
  /** The unit's recipient key (`recipientKey`) and name: "Buying for <name>". */
  forUnit?: { key: string; name: string } | null;
  /** Buy again: the item whose row opens, at the campaign's current price. */
  again?: { itemId: number; name: string; price: number | null } | null;
};

type StorePanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: number;
  warband: Pick<Warband, "id" | "name" | "warband_type" | "counts_as" | "gold">;
  heroes: WarbandHero[];
  henchmenGroups: HenchmenGroup[];
  hirelings: WarbandHireling[];
  /** `capabilities.manage_items`: without it the store is only read. */
  canBuy: boolean;
  opening: StoreOpening;
};

/**
 * The store (design E): a drawer on the web, a sheet on a phone. The list of what the campaign
 * sells, each row's acquire form putting items in the basket, and the basket with Buy all. Opened
 * from a unit, the header says "Buying for <name>" and that unit's button comes first. The basket
 * is the warband's one (Wargear's Get this item shares it), kept for the session until bought.
 */
export default function StorePanel(props: StorePanelProps) {
  const isMobile = useMediaQuery("(max-width: 960px)");
  const { warband, opening } = props;
  const basket = useStoreBasket(warband.id);
  const firstKey = opening.forUnit?.key ?? null;
  const { heroes, henchmenGroups, hirelings } = props;
  const recipients = useMemo(
    () => recipientsFor({ heroes, henchmenGroups, hirelings }, firstKey),
    [firstKey, heroes, henchmenGroups, hirelings]
  );
  const searchers = heroes.map((hero) => ({
    id: hero.id,
    name: hero.name?.trim() || hero.unit_type?.trim() || "Hero",
    spent: hero.trading_action === false,
  }));
  const { data: campaign } = useCampaignQuery(props.campaignId, { read: false });
  const buyer = useBuyer(warband, campaign?.setting_ids) ?? buyerOf(warband, []);
  const gold = warband.gold ?? 0;
  const left = gold - basket.total;
  const buyAll = async () => {
    if (await basket.buyAll()) props.onOpenChange(false);
  };

  return (
    <SidePanel
      open={props.open}
      onOpenChange={props.onOpenChange}
      kicker={
        opening.forUnit
          ? `Buying for ${opening.forUnit.name}`
          : isMobile
            ? "Buying"
            : `Buying for ${warband.name}`
      }
      title="Store"
      actions={
        <span className="font-display text-[22px] font-semibold text-head">
          {left} <span className="font-sans text-xs font-semibold text-faint">gc</span>
        </span>
      }
      footer={
        props.canBuy ? (
          <StoreBasket
            basket={basket}
            gold={gold}
            isMobile={isMobile}
            onBuyAll={() => void buyAll()}
          />
        ) : undefined
      }
    >
      <StoreList
        key={`${opening.again?.itemId ?? ""}:${firstKey ?? ""}`}
        campaignId={props.campaignId}
        warbandId={warband.id}
        buyer={buyer}
        canBuy={props.canBuy}
        recipients={recipients}
        firstKey={firstKey}
        searchers={searchers}
        again={opening.again}
        isMobile={isMobile}
        onPick={basket.add}
      />
    </SidePanel>
  );
}
