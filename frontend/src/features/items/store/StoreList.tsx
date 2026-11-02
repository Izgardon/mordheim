import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Chip } from "@/components/ui/chip";
import { ItemKindIcon } from "@/components/ui/game-icons";
import { Switch } from "@/components/ui/switch";
import { useCatalogue } from "@/lib/catalogue-queries";
import { matchesSearchQuery } from "@/lib/matches-search-query";
import { cn } from "@/lib/utils";

import { useWhoCan } from "../api/who-can-queries";
import { itemKind } from "../item-kind";
import { isCommon, priceLabel, rarityLabel } from "../utils/item-prices";
import { isSold } from "../utils/item-listing";
import AcquireForm from "./AcquireForm";
import {
  STORE_CATEGORIES,
  itemName,
  kindOf,
  searchWords,
  storeCategory,
  type StoreCategory,
} from "./store-items";
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
  onPick: (line: Omit<BasketLine, "id">) => void;
};

/**
 * The store's list (design E, the items rebuild): search, "What I can buy" (on: what the warband
 * can't usually buy is hidden; off: it shows with the server's reason, "Not usually available to
 * Skaven.", and can still be bought), category chips, and a row per item (name, kind, the price
 * row the server picked for the warband, Common or Rare N) whose Get opens its acquire form.
 */
export default function StoreList(props: StoreListProps) {
  const catalogue = useCatalogue("items", props.campaignId);
  const whoCan = useWhoCan(props.campaignId, props.warbandId);
  const [query, setQuery] = useState(props.again?.name ?? "");
  const [onlyMine, setOnlyMine] = useState(true);
  const [category, setCategory] = useState<StoreCategory>("all");
  const [openId, setOpenId] = useState<number | null>(props.again?.itemId ?? null);
  const offers = useMemo(
    () =>
      catalogue.data.filter(isSold).flatMap((item) => {
        const offer = whoCan.items.get(item.id);
        const byId = new Map((item.availabilities ?? []).map((row) => [row.id, row]));
        const rows = (offer?.options ?? []).flatMap((id) => byId.get(id) ?? []);
        if (!offer || !rows.length) return [];
        return [{ item, availability: rows[0], rows, warning: offer.can_buy ? "" : offer.reason }];
      }),
    [catalogue.data, whoCan.items]
  );
  const rows = offers.filter(
    ({ item, warning }) =>
      item.id === openId ||
      ((!onlyMine || !warning) &&
        (category === "all" || storeCategory(item) === category) &&
        matchesSearchQuery(query, ...searchWords(item)))
  );

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
        <Switch checked={onlyMine} onCheckedChange={setOnlyMine}>
          What I can buy
        </Switch>
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
      ) : rows.length === 0 ? (
        <p className="m-0 text-sm text-text2">Nothing in the store by that name.</p>
      ) : null}
      <ul className="m-0 flex list-none flex-col border-t border-line p-0">
        {rows.map(({ item, availability, rows: options, warning }) => {
          const open = openId === item.id;
          return (
            <li key={item.id} className="flex flex-col gap-2.5 border-b border-line py-2.5">
              <div className="flex items-center gap-3">
                <ItemKindIcon kind={itemKind(item)} className="h-5 w-5 text-accent-text" />
                <div className="flex min-w-0 flex-1 flex-col gap-px">
                  <span className="font-bold text-ink">{itemName(item)}</span>
                  <span className="text-xs text-muted-foreground">
                    {props.isMobile ? `${priceLabel(availability)} · ` : `${kindOf(item)}`}
                    {props.isMobile ? (
                      <span className={!isCommon(availability.rarity) ? "text-accent-text" : ""}>
                        {rarityLabel(availability.rarity)}
                      </span>
                    ) : null}
                  </span>
                  {warning ? (
                    <span className="text-xs font-semibold text-danger">{warning}</span>
                  ) : null}
                </div>
                {props.isMobile ? null : (
                  <div className="flex w-24 shrink-0 flex-col text-right">
                    <span className="font-mono text-sm font-bold text-head">
                      {priceLabel(availability)}
                    </span>
                    <span
                      className={cn(
                        "text-xs",
                        !isCommon(availability.rarity) ? "text-accent-text" : "text-faint"
                      )}
                    >
                      {rarityLabel(availability.rarity)}
                    </span>
                  </div>
                )}
                {props.canBuy ? (
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpenId(open ? null : item.id)}
                    className={cn(
                      "shrink-0 border px-3 text-[13px] font-bold",
                      props.isMobile ? "min-h-11 min-w-16" : "min-h-10 min-w-[72px]",
                      open
                        ? "border-border bg-transparent text-muted-foreground"
                        : "border-accent-line bg-accent-soft text-accent-hi"
                    )}
                  >
                    {open ? "Close" : "Get"}
                  </button>
                ) : null}
              </div>
              {open ? (
                <AcquireForm
                  warbandId={props.warbandId}
                  item={item}
                  rows={options}
                  startPrice={props.again?.itemId === item.id ? props.again.price : null}
                  recipients={props.recipients}
                  firstKey={props.firstKey}
                  searchers={props.searchers}
                  isMobile={props.isMobile}
                  onPick={(line) => {
                    props.onPick(line);
                    setOpenId(null);
                  }}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
