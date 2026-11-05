import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Chip } from "@/components/ui/chip";
import { Switch } from "@/components/ui/switch";
import type { TemplateVariant } from "@/features/warband-templates/types/template-types";
import type { TemplateUpgrade } from "@/features/warbands/types/hire-template-types";
import { useCatalogue } from "@/lib/catalogue-queries";
import { matchesSearchQuery } from "@/lib/matches-search-query";
import { cn } from "@/lib/utils";

import { useWhoCan } from "../api/who-can-queries";
import type { ShownItem } from "../components/ItemInfo";
import { isSold } from "../utils/item-listing";
import { hisLine, hisRow, rareBonusFor, type HisList, type HisUpgrades } from "./his-list";
import { STORE_CATEGORIES, searchWords, storeCategory, type StoreCategory } from "./store-items";
import StoreRow, { type StoreOffer } from "./StoreRow";
import StoreUpgrades from "./StoreUpgrades";
import type { BasketLine, Recipient } from "./useStoreBasket";

export type StoreListProps = {
  campaignId: number;
  warbandId: number;
  canBuy: boolean;
  recipients: Recipient[];
  firstKey: string | null;
  searchers: { id: number; name: string; spent: boolean }[];
  /** Buy again: the item whose row opens first, at this price. */
  again?: { itemId: number; name: string; price: number | null } | null;
  isMobile: boolean;
  /** The unit the store is buying for, recruited from the template: his lists. */
  his?: HisList | null;
  /** The warband's variant's terms: where a rare search starts its bonus. */
  variant?: TemplateVariant | null;
  /** The copies of an item the basket holds, for a per-warband limit. */
  inBasket?: (itemId: number) => number;
  /** A hero from the template: his template's upgrades, put in the basket at their price. */
  upgrades?: (HisUpgrades & { onGet: (upgrade: TemplateUpgrade, price: number) => void }) | null;
  onPick: (line: Omit<BasketLine, "id">) => void;
  /** Whether a row's item shows its details at the foot of the store. */
  isShown: (key: string) => boolean;
  onToggleShown: (next: ShownItem) => void;
};

/**
 * The store's list (design E, the items rebuild): search, "What I can buy" (on: what the warband
 * can't usually buy is hidden; off: it shows with the server's reason, "Not usually available to
 * Skaven.", and can still be bought), His list when buying for a unit from the template (on: only
 * his lists' items, as they name them, at the store's price; both on: his items the warband can
 * usually buy), category chips, a hero's Upgrades (his template's), and a row per item.
 */
export default function StoreList(props: StoreListProps) {
  const catalogue = useCatalogue("items", props.campaignId);
  const whoCan = useWhoCan(props.campaignId, props.warbandId);
  const [query, setQuery] = useState(props.again?.name ?? "");
  const [onlyMine, setOnlyMine] = useState(true);
  const [onlyHis, setOnlyHis] = useState(true);
  const [category, setCategory] = useState<StoreCategory>("all");
  const [openId, setOpenId] = useState<number | null>(props.again?.itemId ?? null);
  const offers = useMemo(
    () =>
      catalogue.data.filter(isSold).flatMap((item): StoreOffer[] => {
        const offer = whoCan.items.get(item.id);
        const byId = new Map((item.availabilities ?? []).map((row) => [row.id, row]));
        const rows = (offer?.options ?? []).flatMap((id) => byId.get(id) ?? []);
        if (!offer || !rows.length) return [];
        return [{ item, availability: rows[0], rows, warning: offer.can_buy ? "" : offer.reason }];
      }),
    [catalogue.data, whoCan.items]
  );
  const his = props.his ?? null;
  const hisOn = his !== null && onlyHis;
  const copies = props.recipients.find((entry) => entry.key === props.firstKey)?.count ?? 1;
  const upgrades =
    props.upgrades && category === "all"
      ? props.upgrades.upgrades.filter((upgrade) =>
          matchesSearchQuery(query, upgrade.name, upgrade.group)
        )
      : [];
  const rows = offers.flatMap((offer) => {
    const line = his ? hisLine(his, offer.item.id) : null;
    const shown =
      offer.item.id === openId ||
      ((!onlyMine || !offer.warning) &&
        (!hisOn || line !== null) &&
        (category === "all" || storeCategory(offer.item) === category) &&
        matchesSearchQuery(query, ...searchWords(offer.item), hisOn ? (line?.shown_as ?? "") : ""));
    if (!shown) return [];
    const view =
      hisOn && his && line ? hisRow(his, line, props.inBasket?.(offer.item.id) ?? 0, copies) : null;
    return [{ offer, view }];
  });

  return (
    <div className="flex flex-col gap-3.5">
      <div className={cn("flex gap-2.5", props.isMobile ? "flex-col" : "items-stretch")}>
        <label className="flex min-h-11 flex-1 items-center gap-2 border border-strong bg-page px-3 text-muted-foreground">
          <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search the store"
            aria-label="Search the store"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none"
          />
        </label>
        <div className="flex gap-2.5">
          <Switch checked={onlyMine} onCheckedChange={setOnlyMine}>
            What I can buy
          </Switch>
          {his ? (
            <Switch checked={onlyHis} onCheckedChange={setOnlyHis}>
              His list
            </Switch>
          ) : null}
        </div>
      </div>
      <div
        role="group"
        aria-label="Category"
        className={cn(
          "flex gap-1.5",
          props.isMobile ? "-mx-4 overflow-x-auto px-4 pb-0.5" : "flex-wrap"
        )}
      >
        {STORE_CATEGORIES.map((entry) => (
          <Chip
            key={entry.id}
            pressed={category === entry.id}
            className="shrink-0"
            onClick={() => setCategory(entry.id)}
          >
            {entry.label}
          </Chip>
        ))}
      </div>
      {catalogue.isLoading || whoCan.isLoading ? (
        <p className="m-0 text-sm text-muted-foreground">Opening the store…</p>
      ) : catalogue.error ? (
        <p className="m-0 text-sm text-danger">{catalogue.error}</p>
      ) : rows.length === 0 && upgrades.length === 0 ? (
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
        {rows.map(({ offer, view }) => (
          <StoreRow
            key={offer.item.id}
            offer={offer}
            his={view}
            open={openId === offer.item.id}
            onOpen={(open) => setOpenId(open ? offer.item.id : null)}
            canBuy={props.canBuy}
            isMobile={props.isMobile}
            warbandId={props.warbandId}
            recipients={props.recipients}
            firstKey={props.firstKey}
            searchers={props.searchers}
            startPrice={props.again?.itemId === offer.item.id ? props.again.price : null}
            rareBonus={rareBonusFor(props.variant ?? null, offer.item)}
            onPick={(line) => {
              props.onPick(line);
              setOpenId(null);
            }}
            isShown={props.isShown}
            onToggleShown={props.onToggleShown}
          />
        ))}
      </ul>
    </div>
  );
}
