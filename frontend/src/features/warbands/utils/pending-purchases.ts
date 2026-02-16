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
