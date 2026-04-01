import type { Item } from "../types/item-types";

type PersistedItemCostMeta = {
  isBuying: boolean;
  baseCost: number;
};

export function getPersistedItemCost(
  item: Pick<Item, "cost">,
  meta?: PersistedItemCostMeta
): number | null {
  if (meta && (meta.isBuying || item.cost == null)) {
    return meta.baseCost;
  }
  return item.cost ?? null;
}

export function buildAcquiredItemEntries(
  itemId: number,
  quantity: number,
  item: Pick<Item, "cost">,
  meta?: PersistedItemCostMeta
): Array<{ id: number; cost: number | null }> {
  const count = Math.max(1, Number(quantity) || 1);
  const cost = getPersistedItemCost(item, meta);
  return Array.from({ length: count }, () => ({ id: itemId, cost }));
}
