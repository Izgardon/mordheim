import {
  addWarbandItem,
  createWarbandTrade,
  getWarbandHenchmenGroupDetail,
  getWarbandHeroDetail,
  getWarbandHiredSwordDetail,
  updateWarbandHenchmenGroup,
  updateWarbandHero,
  updateWarbandHiredSword,
} from "../api/warbands-api";

import type {
  HenchmenGroup,
  WarbandHero,
  WarbandHiredSword,
} from "../types/warband-types";
import type { Item } from "../../items/types/item-types";

// ── Types ──────────────────────────────────────────────────────────────

type ItemEntry = { id: number; cost?: number | null };

type UnitWithItems = { id: number; items: ItemEntry[] };

type UnitUpdater<U, P> = (
  warbandId: number,
  unitId: number,
  payload: P,
) => Promise<U>;

type UnitFetcher<U> = (warbandId: number, unitId: number) => Promise<U>;

export type UnitType = "heroes" | "hiredswords" | "henchmen";

// ── Payload builders ───────────────────────────────────────────────────

export const heroPayload = (hero: WarbandHero, items: ItemEntry[]) => ({
  name: hero.name,
  unit_type: hero.unit_type,
  race: hero.race_id ?? null,
  price: hero.price,
  xp: hero.xp,
  items,
});

export const hiredSwordPayload = (hs: WarbandHiredSword, items: ItemEntry[]) => ({
  name: hs.name,
  unit_type: hs.unit_type,
  race: hs.race_id ?? null,
  price: hs.price,
  upkeep_price: hs.upkeep_price ?? 0,
  xp: hs.xp,
  items,
});

export const henchmenGroupPayload = (_g: HenchmenGroup, items: ItemEntry[]) =>
  ({ items } as any);

// ── Target config ──────────────────────────────────────────────────────

const targetConfig: Record<
  UnitType,
  {
    fetch: UnitFetcher<any>;
    update: UnitUpdater<any, any>;
    payload: (unit: any, items: ItemEntry[]) => any;
  }
> = {
  heroes: {
    fetch: getWarbandHeroDetail,
    update: updateWarbandHero,
    payload: heroPayload,
  },
  hiredswords: {
    fetch: getWarbandHiredSwordDetail,
    update: updateWarbandHiredSword,
    payload: hiredSwordPayload,
  },
  henchmen: {
    fetch: getWarbandHenchmenGroupDetail,
    update: updateWarbandHenchmenGroup,
    payload: henchmenGroupPayload,
  },
};

// ── Item removal helper ────────────────────────────────────────────────

function removeItems(currentItems: ItemEntry[], itemId: number, qty: number): ItemEntry[] {
  const items = [...currentItems];
  let removed = 0;
  for (let i = items.length - 1; i >= 0 && removed < qty; i--) {
    if (items[i].id === itemId) {
      items.splice(i, 1);
      removed++;
    }
  }
  if (removed === 0) {
    throw new Error("Item not found.");
  }
  return items;
}

// ── Sell ────────────────────────────────────────────────────────────────

export async function sellUnitItem<U extends UnitWithItems, P>(opts: {
  warbandId: number;
  unit: U;
  item: Item;
  sellQty: number;
  sellPrice: number;
  updateUnit: UnitUpdater<U, P>;
  buildPayload: (unit: U, items: ItemEntry[]) => P;
}): Promise<U> {
  const { warbandId, unit, item, sellQty, sellPrice, updateUnit, buildPayload } = opts;

  const remainingItems = removeItems(
    unit.items.map((i) => ({ id: i.id, cost: i.cost ?? null })),
    item.id,
    sellQty,
  );

  const updated = await updateUnit(warbandId, unit.id, buildPayload(unit, remainingItems));

  await createWarbandTrade(warbandId, {
    action: "Sold",
    description: sellQty > 1 ? `${item.name} x ${sellQty}` : item.name,
    price: sellPrice,
  });

  return updated;
}

// ── Move ────────────────────────────────────────────────────────────────

export async function moveUnitItem<U extends UnitWithItems, P>(opts: {
  warbandId: number;
  unit: U;
  item: Item;
  moveQty: number;
  targetUnitType: string;
  targetUnitId: string;
  updateSource: UnitUpdater<U, P>;
  buildSourcePayload: (unit: U, items: ItemEntry[]) => P;
  fetchSource: UnitFetcher<U>;
}): Promise<{ source: U; target?: WarbandHero | WarbandHiredSword | HenchmenGroup }> {
  const {
    warbandId,
    unit,
    item,
    moveQty,
    targetUnitType,
    targetUnitId,
    updateSource,
    buildSourcePayload,
    fetchSource,
  } = opts;

  const newSourceItems = removeItems(
    unit.items.map((i) => ({ id: i.id, cost: i.cost ?? null })),
    item.id,
    moveQty,
  );

  await updateSource(warbandId, unit.id, buildSourcePayload(unit, newSourceItems));

  if (targetUnitType === "stash") {
    await addWarbandItem(warbandId, item.id, { quantity: moveQty, cost: item.cost ?? undefined });
  } else {
    const config = targetConfig[targetUnitType as UnitType];
    if (config) {
      const targetId = Number(targetUnitId);
      const target = await config.fetch(warbandId, targetId);
      const targetItems: ItemEntry[] = target.items.map((i: ItemEntry) => ({ id: i.id, cost: i.cost ?? null }));
      const addedItems: ItemEntry[] = Array.from({ length: moveQty }, () => ({ id: item.id, cost: item.cost ?? null }));
      await config.update(
        warbandId,
        targetId,
        config.payload(target, [...targetItems, ...addedItems]),
      );
    }
  }

  const freshSource = await fetchSource(warbandId, unit.id);

  if (targetUnitType !== "stash") {
    const config = targetConfig[targetUnitType as UnitType];
    if (config) {
      const freshTarget = await config.fetch(warbandId, Number(targetUnitId));
      return { source: freshSource, target: freshTarget };
    }
  }

  return { source: freshSource };
}
