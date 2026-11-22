import { useMemo, useState } from "react";

import type { TemplateVariant } from "@/features/warband-templates/types/template-types";
import type { TemplateUpgrade } from "@/features/warbands/types/hire-template-types";
import { useCatalogue } from "@/lib/catalogue-queries";
import { matchesSearchQuery } from "@/lib/matches-search-query";

import { useWhoCan } from "../api/who-can-queries";
import type { ShownItem } from "../components/ItemInfo";
import type { WeaponMaterial } from "../types/item-types";
import { isSold } from "../utils/item-listing";
import { rareBonusFor, type HisList, type HisUpgrades } from "./his-list";
import MaterialRow from "./MaterialRow";
import StoreFilters from "./StoreFilters";
import { storeEntries } from "./store-rows";
import type { StoreCategory } from "./store-items";
import StoreRow, { type StoreOffer } from "./StoreRow";
import StoreUpgrades from "./StoreUpgrades";
import type { BasketLine, Recipient } from "./useStoreBasket";

export type StoreListProps = {
  campaignId: number;
  warbandId: number;
  canBuy: boolean;
  /** `edit_catalogue`, as Wargear's Add item: Add item makes a campaign item here. */
  canAddItem?: boolean;
  recipients: Recipient[];
  firstKey: string | null;
  searchers: { id: number; name: string; spent: boolean }[];
  /** Buy again: the item whose row opens first, at this price. */
  again?: { itemId: number; name: string; price: number | null } | null;
  isMobile: boolean;
  /** The unit the store is buying for, recruited from the template: their lists. */
  his?: HisList | null;
  /** The warband's variant's terms: where a rare search starts its bonus. */
  variant?: TemplateVariant | null;
  /** The weapon materials the server offers this warband (weapon materials): a row each. */
  materials?: WeaponMaterial[];
  /** The copies of an item the basket holds, for a per-warband limit. */
  inBasket?: (itemId: number) => number;
  /** A hero from the template: their template's upgrades, put in the basket at their price. */
  upgrades?: (HisUpgrades & { onGet: (upgrade: TemplateUpgrade, price: number) => void }) | null;
  onPick: (line: Omit<BasketLine, "id">) => void;
  /** Whether a row's item shows its details at the foot of the store. */
  isShown: (key: string) => boolean;
  onToggleShown: (next: ShownItem) => void;
};

const NONE = () => 0;

/**
 * The store's list (design E, the items rebuild): search, one switch, Add item, category chips, a
 * hero's Upgrades (their template's), then the items and the weapon materials' rows ("Gromril
 * Weapon", which picks the weapon when opened) in one list, commons first. The switch (William,
 * 22 Nov 2026) is Their list when the store buys for a unit recruited from the template (on: only
 * their lists' items, as they name them, at the store's price; a hero's also the extras
 * `hisExtra` allows; off: what the warband can usually buy), else Warband Only (on: what the
 * warband can't usually buy is hidden; off: it shows with the server's reason, "Not available for
 * Skaven.", and can still be bought). Add item (William, 7 Nov 2026) makes a campaign item and
 * opens its row, found by its name, ready to buy.
 */
export default function StoreList(props: StoreListProps) {
  const catalogue = useCatalogue("items", props.campaignId);
  const whoCan = useWhoCan(props.campaignId, props.warbandId);
  const [query, setQuery] = useState(props.again?.name ?? "");
  const [onlyMine, setOnlyMine] = useState(true);
  const [onlyHis, setOnlyHis] = useState(true);
  const [category, setCategory] = useState<StoreCategory>("all");
  const [openId, setOpenId] = useState<number | null>(props.again?.itemId ?? null);
  const [openMaterial, setOpenMaterial] = useState<string | null>(null);
  const offers = useMemo(
    () =>
      catalogue.data.filter(isSold).flatMap((item): StoreOffer[] => {
        const offer = whoCan.items.get(item.id);
        const byId = new Map((item.availabilities ?? []).map((row) => [row.id, row]));
        const rows = (offer?.options ?? []).flatMap((id) => byId.get(id) ?? []);
        if (!offer || !rows.length) return [];
        return [
          {
            item,
            availability: rows[0],
            rows,
            warning: offer.can_buy ? "" : offer.reason,
            alwaysOpen: Boolean(offer.always_open),
            countsAs: offer.counts_as ?? [],
          },
        ];
      }),
    [catalogue.data, whoCan.items]
  );
  const list = props.his ?? null;
  const entries = storeEntries(offers, props.materials ?? [], {
    query,
    category,
    // a unit with a list has only Their list's switch: off, the warband's usual store
    onlyMine: list ? true : onlyMine,
    his: list && onlyHis ? list : null,
    openId,
    inBasket: props.inBasket ?? NONE,
    copies: props.recipients.find((entry) => entry.key === props.firstKey)?.count ?? 1,
  });
  const upgrades =
    props.upgrades && category === "all"
      ? props.upgrades.upgrades.filter((upgrade) =>
          matchesSearchQuery(query, upgrade.name, upgrade.group)
        )
      : [];
  const shared = {
    canBuy: props.canBuy,
    isMobile: props.isMobile,
    warbandId: props.warbandId,
    recipients: props.recipients,
    firstKey: props.firstKey,
    searchers: props.searchers,
  };

  return (
    <div className="flex flex-col gap-3.5">
      <StoreFilters
        campaignId={props.campaignId}
        isMobile={props.isMobile}
        query={query}
        onQuery={setQuery}
        filter={
          list
            ? { label: "Their list", checked: onlyHis, onChange: setOnlyHis }
            : { label: "Warband Only", checked: onlyMine, onChange: setOnlyMine }
        }
        category={category}
        onCategory={setCategory}
        canAddItem={props.canAddItem}
        onAdded={(item) => {
          setQuery(item.name);
          setOpenId(item.id);
        }}
      />
      {catalogue.isLoading || whoCan.isLoading ? (
        <p className="m-0 text-sm text-muted-foreground">Opening the store…</p>
      ) : catalogue.error ? (
        <p className="m-0 text-sm text-danger">{catalogue.error}</p>
      ) : entries.length === 0 && upgrades.length === 0 ? (
        <p className="m-0 text-sm text-text2">Nothing in the store by that name.</p>
      ) : null}
      {props.upgrades ? (
        <StoreUpgrades
          upgrades={upgrades}
          offUpgrades={props.upgrades.offUpgrades}
          held={props.upgrades.held}
          holds={props.upgrades.holds}
          canBuy={props.canBuy}
          isMobile={props.isMobile}
          onGet={props.upgrades.onGet}
        />
      ) : null}
      <ul className="m-0 flex list-none flex-col border-t border-line p-0">
        {entries.map((entry) =>
          entry.kind === "material" ? (
            <MaterialRow
              key={entry.key}
              {...entry.row}
              {...shared}
              open={openMaterial === entry.row.material.slug}
              onOpen={(open) => setOpenMaterial(open ? entry.row.material.slug : null)}
              rareBonus={(item) => rareBonusFor(props.variant ?? null, item)}
              onPick={props.onPick}
            />
          ) : (
            <StoreRow
              key={entry.key}
              offer={entry.offer}
              his={entry.view}
              {...shared}
              open={openId === entry.offer.item.id}
              onOpen={(open) => setOpenId(open ? entry.offer.item.id : null)}
              startPrice={props.again?.itemId === entry.offer.item.id ? props.again.price : null}
              rareBonus={rareBonusFor(props.variant ?? null, entry.offer.item)}
              onPick={(line) => {
                props.onPick(line);
                setOpenId(null);
              }}
              isShown={props.isShown}
              onToggleShown={props.onToggleShown}
            />
          )
        )}
      </ul>
    </div>
  );
}
