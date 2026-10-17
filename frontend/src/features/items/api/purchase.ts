import {
  addWarbandItem,
  createWarbandLog,
  createWarbandTrade,
  getWarbandHenchmenGroupDetail,
  getWarbandHeroDetail,
  getWarbandHiredSwordDetail,
  updateWarbandHenchmenGroup,
  updateWarbandHero,
  updateWarbandHiredSword,
} from "@/features/warbands/api/warbands-api";
import { buildAcquiredItemEntries, getPersistedItemCost } from "../utils/acquire-item-costs";

import type { Item } from "../types/item-types";
import type { AcquiredUnit, AcquireItemMeta, PurchaseTarget } from "../types/acquire-types";

/** One purchase or gift: the item, who receives it and what the player chose. */
export type PurchaseRequest = {
  warbandId: number;
  target: PurchaseTarget;
  item: Item;
  meta: AcquireItemMeta;
};

type ItemEntry = { id: number; cost: number | null };
type UnitWithItems = { id: number; items?: { id: number; cost?: number | null }[] };

/** The unit's whole item list plus the new copies (a summary row carries no items: load them). */
async function appendItems<U extends UnitWithItems>(
  unit: U,
  added: ItemEntry[],
  loadDetail: () => Promise<U>,
  save: (items: ItemEntry[]) => Promise<U>
) {
  const current = Array.isArray(unit.items) ? unit : await loadDetail();
  const existing = (current.items ?? []).map((entry) => ({
    id: entry.id,
    cost: entry.cost ?? null,
  }));
  return save([...existing, ...added]);
}

/** Stocks the stash (POST) or a unit (its whole item list PATCHed); answers the unit as saved. */
async function writeItems({
  warbandId,
  target,
  item,
  meta,
}: PurchaseRequest): Promise<AcquiredUnit | undefined> {
  if (target.kind === "stash") {
    await addWarbandItem(warbandId, item.id, {
      quantity: meta.quantity,
      cost: getPersistedItemCost(item, meta),
    });
    return undefined;
  }
  const added = buildAcquiredItemEntries(item.id, meta.quantity, item, meta);
  const unitId = target.unit.id;
  switch (target.kind) {
    case "heroes":
      return appendItems(
        target.unit,
        added,
        () => getWarbandHeroDetail(warbandId, unitId),
        (items) => updateWarbandHero(warbandId, unitId, { items })
      );
    case "hiredswords":
      return appendItems(
        target.unit,
        added,
        () => getWarbandHiredSwordDetail(warbandId, unitId),
        (items) => updateWarbandHiredSword(warbandId, unitId, { items })
      );
    case "henchmen":
      return appendItems(
        target.unit,
        added,
        () => getWarbandHenchmenGroupDetail(warbandId, unitId),
        (items) => updateWarbandHenchmenGroup(warbandId, unitId, { items })
      );
  }
}

const LOG_ENTRY_TYPES: Record<PurchaseTarget["kind"], string> = {
  // A stash purchase is a stash entry, not a hero's item named "Stash" (BUG-110).
  stash: "stash_item",
  heroes: "hero_item",
  hiredswords: "hired_sword_item",
  henchmen: "henchmen_item",
};

const UNKNOWN_NAMES: Record<Exclude<PurchaseTarget["kind"], "stash">, string> = {
  heroes: "Unknown Hero",
  hiredswords: "Unknown Hired Sword",
  henchmen: "Unknown Group",
};

/** The "Bought" ledger row (when it costs anything) and the log entry, sent together. */
async function recordPurchase({ warbandId, target, item, meta }: PurchaseRequest) {
  const { isBuying, quantity: count, totalPrice } = meta;
  const reason = meta.reason.trim();
  const records: Promise<unknown>[] = [];
  if (isBuying && totalPrice > 0) {
    records.push(
      createWarbandTrade(warbandId, {
        action: "Bought",
        description: count > 1 ? `${item.name} x ${count}` : item.name,
        price: totalPrice,
      })
    );
  }
  const actor =
    target.kind === "stash" ? {} : { hero: target.unit.name?.trim() || UNKNOWN_NAMES[target.kind] };
  records.push(
    createWarbandLog(warbandId, {
      feature: "loadout",
      entry_type: LOG_ENTRY_TYPES[target.kind],
      payload: {
        ...actor,
        item: item.name,
        ...(isBuying && totalPrice > 0 ? { price: totalPrice } : {}),
        ...(count > 1 ? { quantity: count } : {}),
        ...(!isBuying && reason ? { reason } : {}),
      },
    })
  );
  // A refused record leaves the item unpaid and reaches only the console (BUG-07, PR C).
  const results = await Promise.allSettled(records);
  results.forEach((result) => {
    if (result.status === "rejected") {
      console.error("Post-acquire action failed", result.reason);
    }
  });
}

/**
 * Buys or gives an item, with today's requests: the item write, then (once `onCommitted` has the
 * saved unit) the ledger row and the log. A failed item write throws and records nothing. PR C
 * replaces the body with one `POST purchases/` that does all of it in one transaction.
 */
export async function purchase(
  request: PurchaseRequest,
  onCommitted: (updated: AcquiredUnit | undefined) => void
) {
  const updated = await writeItems(request);
  onCommitted(updated);
  await recordPurchase(request);
}
