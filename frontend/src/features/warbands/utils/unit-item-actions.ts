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

type UnitWithItems = { id: number; items: { id: number }[] };

type UnitUpdater<U, P> = (
  warbandId: number,
  unitId: number,
  payload: P,
) => Promise<U>;

type UnitFetcher<U> = (warbandId: number, unitId: number) => Promise<U>;

export type UnitType = "heroes" | "hiredswords" | "henchmen";

// ── Payload builders ───────────────────────────────────────────────────

export const heroPayload = (hero: WarbandHero, itemIds: number[]) => ({
  name: hero.name,
  unit_type: hero.unit_type,
  race: hero.race_id ?? null,
  price: hero.price,
  xp: hero.xp,
  item_ids: itemIds,
});

export const hiredSwordPayload = (hs: WarbandHiredSword, itemIds: number[]) => ({
  name: hs.name,
  unit_type: hs.unit_type,
  race: hs.race_id ?? null,
  price: hs.price,
  upkeep_price: hs.upkeep_price ?? 0,
  xp: hs.xp,
  item_ids: itemIds,
});

export const henchmenGroupPayload = (_g: HenchmenGroup, itemIds: number[]) =>
  ({ item_ids: itemIds } as any);

// ── Target config ──────────────────────────────────────────────────────

const targetConfig: Record<
  UnitType,
  {
    fetch: UnitFetcher<any>;
    update: UnitUpdater<any, any>;
    payload: (unit: any, itemIds: number[]) => any;
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

function removeItemIds(currentIds: number[], itemId: number, qty: number): number[] {
  const ids = [...currentIds];
  let removed = 0;
  for (let i = ids.length - 1; i >= 0 && removed < qty; i--) {
    if (ids[i] === itemId) {
      ids.splice(i, 1);
      removed++;
    }
  }
  if (removed === 0) {
    throw new Error("Item not found.");
  }
  return ids;
}

// ── Sell ────────────────────────────────────────────────────────────────

export async function sellUnitItem<U extends UnitWithItems, P>(opts: {
  warbandId: number;
  unit: U;
  item: Item;
  sellQty: number;
  sellPrice: number;
  updateUnit: UnitUpdater<U, P>;
  buildPayload: (unit: U, itemIds: number[]) => P;
}): Promise<U> {
  const { warbandId, unit, item, sellQty, sellPrice, updateUnit, buildPayload } = opts;

  const newItemIds = removeItemIds(
    unit.items.map((i) => i.id),
    item.id,
    sellQty,
  );

  const updated = await updateUnit(warbandId, unit.id, buildPayload(unit, newItemIds));

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
  buildSourcePayload: (unit: U, itemIds: number[]) => P;
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

  const newSourceItemIds = removeItemIds(
    unit.items.map((i) => i.id),
    item.id,
    moveQty,
  );

  await updateSource(warbandId, unit.id, buildSourcePayload(unit, newSourceItemIds));

  if (targetUnitType === "stash") {
    await addWarbandItem(warbandId, item.id, { quantity: moveQty });
  } else {
    const config = targetConfig[targetUnitType as UnitType];
    if (config) {
      const targetId = Number(targetUnitId);
      const target = await config.fetch(warbandId, targetId);
      const targetItemIds = target.items.map((i: { id: number }) => i.id);
      const addedIds = Array.from({ length: moveQty }, () => item.id);
      await config.update(
        warbandId,
        targetId,
        config.payload(target, [...targetItemIds, ...addedIds]),
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
