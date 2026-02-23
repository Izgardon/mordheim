import type { Item } from "../../../../items/types/item-types";
import { toNumber } from "../../../utils/warband-utils";

type HenchmenCostInput = {
  price?: number | string | null;
  xp?: number | string | null;
  items?: Item[] | null;
};

export type HenchmenItemBreakdown = {
  item: Item;
  count: number;
  cost: number;
};

export const calculateHenchmenReinforceCost = ({
  price,
  xp,
  items,
}: HenchmenCostInput) => {
  const baseCost = toNumber(price);
  const xpCost = toNumber(xp) * 2;
  const itemCounts = (items ?? []).reduce<Record<number, { item: Item; count: number }>>(
    (acc, item) => {
      if (acc[item.id]) {
        acc[item.id].count += 1;
      } else {
        acc[item.id] = { item, count: 1 };
      }
      return acc;
    },
    {}
  );

  const itemBreakdown: HenchmenItemBreakdown[] = Object.values(itemCounts).map(({ item, count }) => {
    const cost = Number(item.cost ?? 0);
    const normalizedCost = Number.isFinite(cost) ? cost : 0;
    return {
      item,
      count,
      cost: normalizedCost * count,
    };
  });

  const itemsCost = itemBreakdown.reduce((sum, entry) => sum + entry.cost, 0);
  const totalCost = baseCost + itemsCost + xpCost;

  return {
    baseCost,
    xpCost,
    itemsCost,
    totalCost,
    itemBreakdown,
  };
};
