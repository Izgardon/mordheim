import { formatRestrictions } from "@/features/items/utils/availability-format";

import type { Restriction } from "@/features/items/types/item-types";
import type { BestiaryAvailabilityWrite, BestiaryEntrySummary } from "../types/bestiary-types";

/** A restriction on a price, with its note ("Humans" + "knights only"). */
export type ShopRestrictionRow = { key: number; restriction: Restriction; note: string };

/** One price the beast's item is sold at, as the form edits it. */
export type ShopPriceRow = {
  key: number;
  cost: string;
  rarity: string;
  variableCost: string;
  restrictions: ShopRestrictionRow[];
};

export const PRICE_HINT = "Needs a price of 0 or more.";
export const RARITY_HINT = "Needs a rarity from 2 to 20.";
export const NO_PRICE_HINT = "Add a price to sell it in the shop.";
export const FOLDED_PRICES_LINE =
  "Finish or remove the shop prices first: tick Available in the shop to see them.";

const isBlank = (row: ShopPriceRow) =>
  !row.cost.trim() && !row.rarity.trim() && !row.variableCost.trim() && !row.restrictions.length;

/** What is wrong with a row's price and rarity (the server's own limits), by field. */
function rowProblems(row: ShopPriceRow) {
  const problems: { cost?: string; rarity?: string } = {};
  if (!row.cost.trim() || !(Number(row.cost) >= 0)) problems.cost = PRICE_HINT;
  const rarity = Number(row.rarity);
  if (!row.rarity.trim() || Number.isNaN(rarity) || rarity < 2 || rarity > 20) {
    problems.rarity = RARITY_HINT;
  }
  return problems;
}

/**
 * What stops a save before it is sent. Sold: at least one price, each with a price of 0 or more
 * and a rarity from 2 to 20, under its field (the server's paths, `item.availabilities.0.cost`).
 * Not sold: the folded prices are kept and sent too, so a half-filled one stops the save with a
 * line saying how to see it; a blank one is left out.
 */
export function shopProblems(rows: ShopPriceRow[], sold: boolean) {
  const fields: Record<string, string> = {};
  if (!sold) {
    const unfinished = rows.some(
      (row) => !isBlank(row) && Object.keys(rowProblems(row)).length > 0
    );
    return { line: unfinished ? FOLDED_PRICES_LINE : "", fields };
  }
  if (rows.length === 0) {
    fields["item.availabilities"] = NO_PRICE_HINT;
  }
  rows.forEach((row, index) => {
    const problems = rowProblems(row);
    if (problems.cost) fields[`item.availabilities.${index}.cost`] = problems.cost;
    if (problems.rarity) fields[`item.availabilities.${index}.rarity`] = problems.rarity;
  });
  return { line: "", fields };
}

/** The prices a write sends: every row while sold, the filled ones while folded away. */
export function shopPayload(rows: ShopPriceRow[], sold: boolean): BestiaryAvailabilityWrite[] {
  return rows
    .filter((row) => sold || !isBlank(row))
    .map((row) => ({
      cost: Number(row.cost),
      rarity: Number(row.rarity),
      variable_cost: row.variableCost.trim() || null,
      restrictions: row.restrictions.map((link) => ({
        restriction_id: link.restriction.id,
        additional_note: link.note.trim(),
      })),
    }));
}

/**
 * What the shop sells a beast at, in a line: "80 gc · Rare 11 · Humans", "15 gc (+D6) · Common",
 * or "Not sold". The first price stands for the rest.
 */
export function shopLine(entry: Pick<BestiaryEntrySummary, "available_in_shop" | "item">) {
  if (!entry.available_in_shop) {
    return "Not sold";
  }
  const price = entry.item?.availabilities?.[0];
  if (!price) {
    return "Sold, no price yet";
  }
  const rarity = price.rarity === 2 ? "Common" : `Rare ${price.rarity}`;
  const variable = price.variable_cost ? ` (${price.variable_cost})` : "";
  const restricted = price.restrictions?.length ? ` · ${formatRestrictions(price)}` : "";
  return `${price.cost} gc${variable} · ${rarity}${restricted}`;
}
