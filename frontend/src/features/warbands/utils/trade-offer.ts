import type { TradeOffer, TradeOfferItem } from "../types/trade-request-types";
import type { WarbandItemSummary } from "../types/warband-types";

/** An offer with every field present, as the trade dialog edits it. */
export type DraftOffer = Required<TradeOffer>;

/** A stash row with how many copies it holds and how many are not yet in the offer. */
export type OfferableStashItem = WarbandItemSummary & { total: number; available: number };

export const normalizeOffer = (offer?: TradeOffer): DraftOffer => ({
  trader_id: offer?.trader_id ?? null,
  trader_name: offer?.trader_name ?? null,
  gold: Math.max(0, Number(offer?.gold ?? 0)),
  items: Array.isArray(offer?.items) ? (offer?.items ?? []) : [],
});

/** What an offer is worth: its gold plus each item's copies at the cost it was sent with. */
export function offerValue(offer?: TradeOffer) {
  const gold = Math.max(0, Number(offer?.gold ?? 0));
  const items = Array.isArray(offer?.items) ? (offer?.items ?? []) : [];
  const itemTotal = items.reduce((sum, item) => {
    const quantity = Math.max(0, Number(item.quantity ?? 0));
    const cost = Math.max(0, Number(item.cost ?? 0));
    return sum + quantity * cost;
  }, 0);
  return gold + itemTotal;
}

/** The offer as the server takes it: the trader, gold capped at what you have, the items. */
export const buildOfferPayload = (offer: DraftOffer, maxGold: number) => ({
  trader_id: offer.trader_id ?? null,
  gold: Math.min(Math.max(0, Number(offer.gold || 0)), maxGold),
  items: offer.items.map((item) => ({
    id: item.id,
    name: item.name,
    quantity: Math.max(0, Number(item.quantity) || 0),
  })),
});

/** The stash with what the offer leaves of each row. */
export function offerableStash(stash: WarbandItemSummary[], offer: DraftOffer) {
  const offered = new Map<number, number>();
  offer.items.forEach((item) => offered.set(item.id, (offered.get(item.id) ?? 0) + item.quantity));
  return stash.map((item): OfferableStashItem => {
    const total = Math.max(0, Number(item.quantity ?? 0));
    return { ...item, total, available: Math.max(0, total - (offered.get(item.id) ?? 0)) };
  });
}

/** One more copy of a stash row in the offer, at the row's cost. */
export function addOfferItem(offer: DraftOffer, item: WarbandItemSummary): DraftOffer {
  const items = [...offer.items];
  const index = items.findIndex((entry) => entry.id === item.id);
  if (index === -1) {
    items.push({ id: item.id, name: item.name, quantity: 1, cost: item.cost ?? 0 });
  } else {
    items[index] = {
      ...items[index],
      cost: items[index].cost ?? item.cost ?? 0,
      quantity: items[index].quantity + 1,
    };
  }
  return { ...offer, items };
}

/** One copy fewer of an offered item (the last one leaves the offer). */
export function removeOfferItem(offer: DraftOffer, item: TradeOfferItem): DraftOffer {
  const items = offer.items
    .map((entry) => (entry.id === item.id ? { ...entry, quantity: entry.quantity - 1 } : entry))
    .filter((entry) => entry.quantity > 0);
  return { ...offer, items };
}

/** The offer's gold as typed, kept between 0 and what you have. */
export const withOfferGold = (offer: DraftOffer, typed: string, maxGold: number): DraftOffer => ({
  ...offer,
  gold: Math.min(Math.max(0, Number(typed || 0)), maxGold),
});

/** The offer's trader from the picker's value ("none" for no trader). */
export function withOfferTrader(offer: DraftOffer, value: string): DraftOffer {
  const trader = value === "none" ? null : Number(value);
  return { ...offer, trader_id: Number.isNaN(trader) ? null : trader };
}
