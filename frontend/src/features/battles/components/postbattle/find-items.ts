import type { Item } from "@/features/items/types/item-types";

const availabilityCosts = (item: Item) =>
  (Array.isArray(item.availabilities) ? item.availabilities : [])
    .map((availability) => availability?.cost)
    .filter((cost): cost is number => typeof cost === "number" && Number.isFinite(cost))
    .map((cost) => Math.max(0, Math.trunc(cost)));

/** What a found item is worth: its cheapest availability, or null when it has none. */
export function resolveFindItemCost(item: Item) {
  const costs = availabilityCosts(item);
  return costs.length === 0 ? null : Math.min(...costs);
}

/** The finds picker's cost line: every availability's cost, or "No base cost". */
export function getItemAvailabilityCostLabel(item: Item) {
  const costs = availabilityCosts(item);
  return costs.length === 0 ? "No base cost" : costs.map((cost) => `${cost} gc`).join(" / ");
}
