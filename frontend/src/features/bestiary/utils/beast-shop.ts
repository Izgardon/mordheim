import { priceLabel, rarityLabel, whoLine } from "@/features/items/utils/item-prices";
import {
  isBlankRow,
  priceRowProblems,
  priceRowsPayload,
  type PriceRowDraft,
} from "@/features/items/utils/price-rows";

import type { BestiaryAvailabilityWrite, BestiaryEntrySummary } from "../types/bestiary-types";

export const NO_PRICE_HINT = "Add a price to sell it in the shop.";
export const FOLDED_PRICES_LINE =
  "Finish or remove the shop prices first: tick Available in the shop to see them.";

/**
 * What stops a save before it is sent. Sold: at least one price, each within the server's limits,
 * under its field (the server's paths, `item.availabilities.0.cost`). Not sold: the folded prices
 * are kept and sent too, so a half-filled one stops the save with a line saying how to see it; a
 * blank one is left out.
 */
export function shopProblems(rows: PriceRowDraft[], sold: boolean) {
  if (!sold) {
    const filled = rows.filter((row) => !isBlankRow(row));
    const unfinished = Object.keys(priceRowProblems(filled, "item.availabilities")).length > 0;
    return { line: unfinished ? FOLDED_PRICES_LINE : "", fields: {} as Record<string, string> };
  }
  const fields = priceRowProblems(rows, "item.availabilities");
  if (rows.length === 0) fields["item.availabilities"] = NO_PRICE_HINT;
  return { line: "", fields };
}

/** The prices a write sends: every row while sold, the filled ones while folded away. */
export const shopPayload = (rows: PriceRowDraft[], sold: boolean): BestiaryAvailabilityWrite[] =>
  priceRowsPayload(rows.filter((row) => sold || !isBlankRow(row)));

/**
 * What the shop sells a beast at, in a line: "80 gc · Rare 11 · For Reiklanders", "15 + D6 gc ·
 * Common · For everyone", or "Not sold". The first price stands for the rest.
 */
export function shopLine(entry: Pick<BestiaryEntrySummary, "available_in_shop" | "item">) {
  if (!entry.available_in_shop) {
    return "Not sold";
  }
  const price = entry.item?.availabilities?.[0];
  if (!price) {
    return "Sold, no price yet";
  }
  return `${priceLabel(price)} · ${rarityLabel(price.rarity)} · ${whoLine(price)}`;
}
