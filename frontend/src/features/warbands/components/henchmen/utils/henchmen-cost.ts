import type { Item } from "../../../../items/types/item-types";
import { toNumber } from "../../../utils/warband-utils";

type HenchmenCostInput = {
  price?: number | string | null;
  xp?: number | string | null;
  items?: Item[] | null;
  henchmen?: unknown[] | number | null;
};

export type HenchmenItemBreakdown = {
  item: Item;
  count: number;
  multiplier: number;
  cost: number;
};

export const getHenchmenItemMultiplier = (count: number, henchmenCount: number) => {
  if (henchmenCount <= 0) {
    return 1;
  }
  return Math.floor(count / henchmenCount);
};

const resolveHenchmenCount = (value: HenchmenCostInput["henchmen"]) => {
  if (Array.isArray(value)) {
    return value.length;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, value);
  }
  return 0;
};

export const calculateHenchmenReinforceCost = ({
  price,
  xp,
  items,
  henchmen,
}: HenchmenCostInput) => {
  const baseCost = toNumber(price);
  const xpCost = toNumber(xp) * 2;
  const henchmenCount = resolveHenchmenCount(henchmen);
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
    const multiplier = getHenchmenItemMultiplier(count, henchmenCount);
    return {
      item,
      count,
      multiplier,
      cost: normalizedCost * multiplier,
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
    henchmenCount,
  };
};
