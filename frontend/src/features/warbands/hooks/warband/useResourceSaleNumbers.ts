import { useState } from "react";

import { wyrdstonePrice } from "../../utils/wyrdstone-prices";

/** What prices a sale of the default resource: the campaign's table and the warband's band. */
export type SalePricing = { table?: number[][]; band: number };

/**
 * A resource sale's numbers: how many, the size band and the total. Selling the default resource
 * (`priced`), the total is the table's for the shards and the band (the warband's own until one
 * is picked) until the player types another, and a new count or band takes the table's again.
 * Other resources keep the total as typed.
 */
export function useResourceSaleNumbers(pricing: SalePricing, priced: boolean) {
  const [quantity, setQuantity] = useState("1");
  const [picked, setPicked] = useState<number | null>(null);
  const [typed, setTyped] = useState<string | null>(null);
  const count = Math.max(1, Number(quantity) || 1);
  const band = picked ?? pricing.band;
  const fromTable = priced ? wyrdstonePrice(pricing.table, count, band) : null;
  const price = typed ?? (fromTable === null ? "" : String(fromTable));

  return {
    quantity,
    count,
    band,
    price,
    gold: Number(price) || 0,
    setQuantity: (text: string) => {
      setQuantity(text);
      if (priced) setTyped(null);
    },
    setBand: (next: number) => {
      setPicked(next);
      setTyped(null);
    },
    setPrice: (text: string) => setTyped(text),
    /** A new sale: one, the warband's own band and the table's total. */
    reset: () => {
      setQuantity("1");
      setPicked(null);
      setTyped(null);
    },
  };
}
