import type { UnitTypeOption } from "@components/unit-selection-section";

import { createWarbandLog, createWarbandTrade } from "@/features/warbands/api/warbands-api";

export type PendingPurchase = {
  unitType: UnitTypeOption;
  unitId: string;
  itemId: number;
  itemName: string;
  quantity: number;
  unitPrice: number;
  isBuying: boolean;
  reason?: string;
};

export type PendingChangeItem = {
  label: string;
  category: "buy_item" | "new_henchman" | "stash_consume";
  quantity: number;
  unitCost: number;
  amount: number;
};

export const buildPendingChanges = (purchases: PendingPurchase[]): PendingChangeItem[] =>
  purchases
    .filter((p) => p.isBuying)
    .map((p) => ({
      label: p.itemName,
      category: "buy_item" as const,
      quantity: p.quantity,
      unitCost: p.unitPrice,
      amount: p.quantity * p.unitPrice,
    }));

export const buildHenchmenPendingChanges = (
  purchases: PendingPurchase[],
  groupForms: Array<{
    id?: number;
    name: string;
    henchmen: Array<{
      id?: number | null;
      name: string;
      cost?: number | string;
      itemChoices?: Array<{ itemId: number; action: string }>;
    }>;
    items: Array<{ id: number; name: string }>;
  }>,
): PendingChangeItem[] => {
  const items = buildPendingChanges(purchases);

  for (const group of groupForms) {
    if (!group.id) continue;
    const groupLabel = group.name?.trim() || "Group";
    for (const h of group.henchmen) {
      if (h.id) continue;
      const cost = Number(h.cost);
      if (Number.isFinite(cost) && cost > 0) {
        items.push({
          label: `${h.name?.trim() || "Unnamed"} (${groupLabel})`,
          category: "new_henchman",
          quantity: 1,
          unitCost: cost,
          amount: cost,
        });
      }
      if (h.itemChoices) {
        for (const choice of h.itemChoices) {
          if (choice.action !== "stash") continue;
          const item = group.items.find((i) => i.id === choice.itemId);
          items.push({
            label: `${item?.name ?? `Item #${choice.itemId}`} (from stash)`,
            category: "stash_consume",
            quantity: 1,
            unitCost: 0,
            amount: 0,
          });
        }
      }
    }
  }

  return items;
};

export const getPendingSpend = (purchases: PendingPurchase[]) =>
  purchases.reduce((sum, entry) => {
    if (!entry.isBuying) {
      return sum;
    }
    const qty = Number(entry.quantity) || 0;
    const price = Number(entry.unitPrice) || 0;
    return sum + qty * price;
  }, 0);

export const removePendingPurchase = (
  purchases: PendingPurchase[],
  match: { unitType: UnitTypeOption; unitId: string; itemId: number }
) => {
  for (let i = purchases.length - 1; i >= 0; i -= 1) {
    const entry = purchases[i];
    if (entry.unitType !== match.unitType) continue;
    if (entry.unitId !== match.unitId) continue;
    if (entry.itemId !== match.itemId) continue;
    if (entry.quantity > 1) {
      const next = purchases.slice();
      next[i] = { ...entry, quantity: entry.quantity - 1 };
      return next;
    }
    return [...purchases.slice(0, i), ...purchases.slice(i + 1)];
  }
  return purchases;
};

export async function commitPendingPurchases(
  warbandId: number,
  purchases: PendingPurchase[],
  resolveActorName: (entry: PendingPurchase) => string
) {
  for (const entry of purchases) {
    const quantity = Math.max(1, Number(entry.quantity) || 1);
    const unitPrice = Math.max(0, Number(entry.unitPrice) || 0);
    const totalPrice = unitPrice * quantity;

    if (entry.isBuying && totalPrice > 0) {
      await createWarbandTrade(
        warbandId,
        {
          action: "Bought",
          description: quantity > 1 ? `${entry.itemName} x ${quantity}` : entry.itemName,
          price: totalPrice,
        },
        { emitUpdate: false }
      );
    }

    const entryType =
      entry.unitType === "henchmen"
        ? "henchmen_item"
        : entry.unitType === "hiredswords"
          ? "hired_sword_item"
          : "hero_item";

    await createWarbandLog(
      warbandId,
      {
        feature: "loadout",
        entry_type: entryType,
        payload: {
          hero: resolveActorName(entry),
          item: entry.itemName,
          ...(entry.isBuying && totalPrice > 0 ? { price: totalPrice } : {}),
          ...(quantity > 1 ? { quantity } : {}),
          ...(!entry.isBuying && entry.reason?.trim() ? { reason: entry.reason.trim() } : {}),
        },
      },
      { emitUpdate: false }
    );
  }
}
