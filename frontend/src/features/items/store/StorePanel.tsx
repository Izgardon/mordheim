import { useMemo } from "react";

import { SidePanel } from "@/components/ui/side-panel";
import { useWarbandHireTemplate } from "@/features/warbands/api/warband-template-queries";
import type {
  HenchmenGroup,
  Warband,
  WarbandHero,
  WarbandHireling,
} from "@/features/warbands/types/warband-types";
import { useMediaQuery } from "@/lib/use-media-query";

import ItemInfo, { useShownItem } from "../components/ItemInfo";
import { hisListFor, variantTerms } from "./his-list";
import StoreBasket from "./StoreBasket";
import StoreList from "./StoreList";
import { recipientsFor, useStoreBasket } from "./useStoreBasket";

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
  warband: Pick<Warband, "id" | "name" | "gold">;
  heroes: WarbandHero[];
  henchmenGroups: HenchmenGroup[];
  hirelings: WarbandHireling[];
  /** `capabilities.manage_items`: without it the store is only read. */
  canBuy: boolean;
  opening: StoreOpening;
};

/**
 * The store (design E): a drawer on the web, a sheet on a phone. The list of what the campaign
 * sells, each row's acquire form putting items in the basket, the details of the item whose row
 * was clicked above the basket, and the basket with Buy all. Opened
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
  const details = useShownItem(props.open);
  // the template the roster reads ahead: His list for a unit recruited from it, the variant's rare bonus
  const template = useWarbandHireTemplate(props.campaignId, warband.id, props.open).data;
  const his = hisListFor(template, { heroes, henchmenGroups }, firstKey);
  const inBasket = (itemId: number) =>
    basket.lines
      .filter((line) => line.item.id === itemId)
      .reduce((sum, line) => sum + line.recipient.count, 0);
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
      dock={
        details.shown ? (
          <ItemInfo
            item={details.shown.item}
            availability={details.shown.availability ?? null}
            onClose={details.close}
          />
        ) : null
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
        canBuy={props.canBuy}
        recipients={recipients}
        firstKey={firstKey}
        searchers={searchers}
        again={opening.again}
        isMobile={isMobile}
        his={his}
        variant={variantTerms(template)}
        inBasket={inBasket}
        onPick={basket.add}
        isShown={details.isShown}
        onToggleShown={details.toggle}
      />
    </SidePanel>
  );
}
