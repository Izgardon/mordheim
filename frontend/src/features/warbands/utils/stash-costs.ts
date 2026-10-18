import type { SalePriceBasis } from "@/features/items/types/item-types";
import type { StashCost } from "../types/warband-types";

/** The picker's choice for copies of any cost: the server takes the ones that leave first. */
export const ANY_COST = "any";

/** "12 gc", or "unknown cost" for copies stored without one. */
export const costLabel = (cost: number | null) => (cost === null ? "unknown cost" : `${cost} gc`);

/** "1 at 12 gc, 2 at 9 gc" for a stash entry holding copies at several costs; "" otherwise. */
export const costsSummary = (costs?: StashCost[]) =>
  costs && costs.length > 1
    ? costs.map((entry) => `${entry.quantity} at ${costLabel(entry.cost)}`).join(", ")
    : "";

/** A picker key for one cost ("null" for copies of unknown cost). */
export const costKey = (cost: number | null) => String(cost);

/** The copies the picker names, or undefined for copies of any cost. */
export const pickedCost = (costs: StashCost[] | undefined, key: string) =>
  key === ANY_COST ? undefined : costs?.find((entry) => costKey(entry.cost) === key);

/**
 * One copy's sale price to start from (decision 3): the server's suggestion, or half the picked
 * copies' cost when the suggestion came from the stored cost. Without a suggestion from the server
 * (`undefined`), half the item's cost; `null` when no price is known.
 */
export function saleUnitPrice(options: {
  suggested: number | null | undefined;
  basis: SalePriceBasis | null | undefined;
  picked: StashCost | undefined;
  itemCost: number | null | undefined;
}): number | null {
  const { suggested, basis, picked, itemCost } = options;
  if (basis === "stored_cost" && picked && picked.cost !== null) {
    return Math.ceil(picked.cost / 2);
  }
  return suggested !== undefined ? suggested : Math.ceil((itemCost ?? 0) / 2);
}
