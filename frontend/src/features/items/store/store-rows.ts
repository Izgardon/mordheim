import { matchesSearchQuery } from "@/lib/matches-search-query";

import type { WeaponMaterial } from "../types/item-types";
import { hisExtra, hisLine, hisMaterials, hisRow, takesExtras, type HisList } from "./his-list";
import { materialRows, type MaterialRowView } from "./material-rows";
import {
  rarityOf,
  searchWords,
  storeCategory,
  storeOrder,
  type StoreCategory,
} from "./store-items";
import type { HisRowView, StoreOffer } from "./StoreRow";

/** A row of the store: an item (with what Their list shows of it), or a weapon material's. */
export type StoreEntry =
  | { kind: "item"; key: string; offer: StoreOffer; view: HisRowView | null }
  | { kind: "material"; key: string; row: MaterialRowView };

/** What the store is showing now. */
export type StoreView = {
  query: string;
  category: StoreCategory;
  /** Warband Only: what the warband can't usually buy is hidden. */
  onlyMine: boolean;
  /** Their list, while it is on: only their lines (and, for a hero, `hisExtra`). */
  his: HisList | null;
  /** The item whose acquire form is open (Buy again, Add item): it always shows. */
  openId: number | null;
  /** The copies of an item the basket holds, for a per-warband limit. */
  inBasket: (itemId: number) => number;
  /** How many copies one pick gives the unit the store is buying for. */
  copies: number;
};

const sortOf = (entry: StoreEntry) =>
  entry.kind === "item"
    ? { name: entry.view?.name ?? entry.offer.item.name, rarity: rarityOf(entry.offer.rows) }
    : { name: entry.row.name, rarity: entry.row.material.rarity };

/**
 * The store's rows: each item the filters let through (on Their list, their lines as their list
 * names them, a hero's extras beside them) and each weapon material's row, mixed together in the
 * store's order (William, 22 Nov 2026: material rows "mixed in properly", commons first).
 */
export function storeEntries(
  offers: StoreOffer[],
  materials: WeaponMaterial[],
  view: StoreView
): StoreEntry[] {
  const { his } = view;
  const items = offers.flatMap((offer): StoreEntry[] => {
    const line = his ? hisLine(his, offer.item.id) : null;
    const shown =
      offer.item.id === view.openId ||
      ((!view.onlyMine || !offer.warning) &&
        (!his || line !== null || hisExtra(his, offer)) &&
        (view.category === "all" || storeCategory(offer.item) === view.category) &&
        matchesSearchQuery(view.query, ...searchWords(offer.item), line?.shown_as ?? ""));
    if (!shown) return [];
    const shownAs =
      his && line ? hisRow(his, line, view.inBasket(offer.item.id), view.copies) : null;
    return [{ kind: "item", key: `item:${offer.item.id}`, offer, view: shownAs }];
  });
  const weapons = his
    ? {
        lines: hisMaterials(his),
        melee: offers.filter((offer) => hisLine(his, offer.item.id) !== null),
        open: takesExtras(his),
      }
    : null;
  const rows = materialRows(materials, offers, view, weapons).map(
    (row): StoreEntry => ({ kind: "material", key: `material:${row.material.slug}`, row })
  );
  return storeOrder([...items, ...rows], view.query, sortOf);
}
