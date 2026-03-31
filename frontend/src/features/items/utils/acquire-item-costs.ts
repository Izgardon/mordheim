import type { Item } from "../types/item-types";

type PersistedItemCostMeta = {
  isBuying: boolean;
  baseCost: number;
};

export function getPersistedItemCost(
  item: Pick<Item, "cost">,
  meta?: PersistedItemCostMeta
): number | null {
  if (meta?.isBuying) {
    return meta.baseCost;
  }
  return item.cost ?? null;
}
