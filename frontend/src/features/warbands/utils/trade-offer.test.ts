import { describe, expect, it } from "vitest";

import {
  addOfferItem,
  buildOfferPayload,
  normalizeOffer,
  offerableStash,
  offerValue,
  removeOfferItem,
  withOfferGold,
  withOfferTrader,
} from "./trade-offer";
import { makeStashItem } from "@/test/warband-fixtures";

const sword = makeStashItem({ id: 101, name: "Sword", cost: 10, quantity: 2 });
const rope = makeStashItem({ id: 120, name: "Rope", cost: 5, quantity: 1 });

describe("trade offers", () => {
  it("fill in a missing offer's fields", () => {
    expect(normalizeOffer()).toEqual({ trader_id: null, trader_name: null, gold: 0, items: [] });
    expect(normalizeOffer({ gold: -5 }).gold).toBe(0);
  });

  it("value gold plus each item's copies at the cost it was sent with", () => {
    expect(
      offerValue({
        gold: 10,
        items: [
          { id: 101, name: "Sword", quantity: 2, cost: 10 },
          { id: 300, name: "Wyrdstone", quantity: 3, cost: null },
        ],
      })
    ).toBe(30);
    expect(offerValue(undefined)).toBe(0);
  });

  it("add a stash row one copy at a time, at its cost, and take copies back", () => {
    const once = addOfferItem(normalizeOffer(), sword);
    const twice = addOfferItem(once, sword);
    expect(twice.items).toEqual([{ id: 101, name: "Sword", quantity: 2, cost: 10 }]);

    expect(removeOfferItem(twice, twice.items[0]).items).toEqual([
      { id: 101, name: "Sword", quantity: 1, cost: 10 },
    ]);
    expect(removeOfferItem(once, once.items[0]).items).toEqual([]);
  });

  it("leave each stash row's copies that aren't offered yet", () => {
    const offer = addOfferItem(normalizeOffer(), sword);
    expect(
      offerableStash([sword, rope], offer).map(({ id, total, available }) => ({
        id,
        total,
        available,
      }))
    ).toEqual([
      { id: 101, total: 2, available: 1 },
      { id: 120, total: 1, available: 1 },
    ]);
  });

  it("keep typed gold between 0 and what you have, and read the trader picker", () => {
    expect(withOfferGold(normalizeOffer(), "500", 120).gold).toBe(120);
    expect(withOfferGold(normalizeOffer(), "-3", 120).gold).toBe(0);
    expect(withOfferGold(normalizeOffer(), "", 120).gold).toBe(0);
    expect(withOfferTrader(normalizeOffer(), "11").trader_id).toBe(11);
    expect(withOfferTrader(normalizeOffer({ trader_id: 11 }), "none").trader_id).toBeNull();
  });

  it("send the trader, the gold capped at what you have, and the items without cost", () => {
    const offer = { ...addOfferItem(normalizeOffer(), rope), gold: 500, trader_id: 11 };
    expect(buildOfferPayload(offer, 120)).toEqual({
      trader_id: 11,
      gold: 120,
      items: [{ id: 120, name: "Rope", quantity: 1 }],
    });
  });
});
