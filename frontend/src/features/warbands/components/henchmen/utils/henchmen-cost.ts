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

type HireCostBasis = {
  price: string;
  xp: string;
  items: { id: number }[];
  hire_cost?: number;
  hireCostFor?: string;
};

/** What the server's hire_cost was worked out from: the group's price, XP and items. */
export const hireCostKey = (group: Omit<HireCostBasis, "hire_cost" | "hireCostFor">) =>
  `${group.price}|${group.xp}|${group.items.map((item) => item.id).join(",")}`;

/** The server's hire_cost while the form still has the price, XP and items it was for. */
export const currentHireCost = (group: HireCostBasis) =>
  group.hire_cost !== undefined && group.hireCostFor === hireCostKey(group)
    ? group.hire_cost
    : undefined;

export const getHenchmenItemMultiplier = (count: number, henchmenCount: number) => {
  if (henchmenCount <= 0) {
    return 1;
  }
  return Math.max(1, Math.floor(count / henchmenCount));
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
  // Whole XP only, half a point dropped, as the server's hire_cost counts it (decision 7).
  const xpCost = Math.floor(toNumber(xp)) * 2;
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

  const itemBreakdown: HenchmenItemBreakdown[] = Object.values(itemCounts).map(
    ({ item, count }) => {
      const cost = Number(item.cost ?? 0);
      const normalizedCost = Number.isFinite(cost) ? cost : 0;
      const multiplier = getHenchmenItemMultiplier(count, henchmenCount);
      return {
        item,
        count,
        multiplier,
        cost: normalizedCost * multiplier,
      };
    }
  );

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
