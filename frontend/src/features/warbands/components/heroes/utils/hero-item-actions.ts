import {
  addWarbandItem,
  createWarbandTrade,
  getWarbandHenchmenGroupDetail,
  getWarbandHeroDetail,
  getWarbandHiredSwordDetail,
  updateWarbandHenchmenGroup,
  updateWarbandHero,
  updateWarbandHiredSword,
} from "../../../api/warbands-api";

import type { HenchmenGroup, WarbandHero, WarbandHiredSword } from "../../../types/warband-types";
import type { Item } from "../../../../items/types/item-types";

export async function sellHeroItem(
  warbandId: number,
  hero: WarbandHero,
  item: Item,
  sellQty: number,
  sellPrice: number,
): Promise<WarbandHero> {
  const currentItemIds = hero.items.map((i) => i.id);
  const newItemIds = [...currentItemIds];

  let removed = 0;
  for (let i = newItemIds.length - 1; i >= 0 && removed < sellQty; i--) {
    if (newItemIds[i] === item.id) {
      newItemIds.splice(i, 1);
      removed++;
    }
  }

  if (removed === 0) {
    throw new Error("Item not found on this hero.");
  }

  const updatedHero = await updateWarbandHero(warbandId, hero.id, {
    name: hero.name,
    unit_type: hero.unit_type,
    race: hero.race_id ?? null,
    price: hero.price,
    xp: hero.xp,
    item_ids: newItemIds,
  });

  await createWarbandTrade(warbandId, {
    action: "Sold",
    description: sellQty > 1 ? `${item.name} x ${sellQty}` : item.name,
    price: sellPrice,
  });

  return updatedHero;
}

export async function moveHeroItem(
  warbandId: number,
  hero: WarbandHero,
  item: Item,
  moveQty: number,
  unitType: string,
  unitId: string,
): Promise<{ source: WarbandHero; target?: WarbandHero | WarbandHiredSword | HenchmenGroup }> {
  const sourceItemIds = hero.items.map((i) => i.id);
  const newSourceItemIds = [...sourceItemIds];

  let removed = 0;
  for (let i = newSourceItemIds.length - 1; i >= 0 && removed < moveQty; i--) {
    if (newSourceItemIds[i] === item.id) {
      newSourceItemIds.splice(i, 1);
      removed++;
    }
  }

  if (removed === 0) {
    throw new Error("Item not found on this hero.");
  }

  await updateWarbandHero(warbandId, hero.id, {
    name: hero.name,
    unit_type: hero.unit_type,
    race: hero.race_id ?? null,
    price: hero.price,
    xp: hero.xp,
    item_ids: newSourceItemIds,
  });

  if (unitType === "stash") {
    for (let i = 0; i < moveQty; i++) {
      await addWarbandItem(warbandId, item.id);
    }
  } else if (unitType === "hiredswords") {
    const targetId = Number(unitId);
    const target = await getWarbandHiredSwordDetail(warbandId, targetId);
    const targetItemIds = target.items.map((i) => i.id);
    const addedIds = Array.from({ length: moveQty }, () => item.id);
    await updateWarbandHiredSword(warbandId, targetId, {
      name: target.name,
      unit_type: target.unit_type,
      race: target.race_id ?? null,
      price: target.price,
      upkeep_price: target.upkeep_price ?? 0,
      xp: target.xp,
      item_ids: [...targetItemIds, ...addedIds],
    });
  } else if (unitType === "henchmen") {
    const targetId = Number(unitId);
    const target = await getWarbandHenchmenGroupDetail(warbandId, targetId);
    const targetItemIds = target.items.map((i) => i.id);
    const addedIds = Array.from({ length: moveQty }, () => item.id);
    await updateWarbandHenchmenGroup(warbandId, targetId, {
      item_ids: [...targetItemIds, ...addedIds],
    } as any);
  } else {
    const targetHeroId = Number(unitId);
    const targetHero = await getWarbandHeroDetail(warbandId, targetHeroId);
    const targetItemIds = targetHero.items.map((i) => i.id);
    const addedIds = Array.from({ length: moveQty }, () => item.id);
    await updateWarbandHero(warbandId, targetHeroId, {
      name: targetHero.name,
      unit_type: targetHero.unit_type,
      race: targetHero.race_id ?? null,
      price: targetHero.price,
      xp: targetHero.xp,
      item_ids: [...targetItemIds, ...addedIds],
    });
  }

  const freshSource = await getWarbandHeroDetail(warbandId, hero.id);

  if (unitType !== "stash") {
    if (unitType === "hiredswords") {
      const freshTarget = await getWarbandHiredSwordDetail(warbandId, Number(unitId));
      return { source: freshSource, target: freshTarget };
    }
    if (unitType === "henchmen") {
      const freshTarget = await getWarbandHenchmenGroupDetail(warbandId, Number(unitId));
      return { source: freshSource, target: freshTarget };
    }
    const freshTarget = await getWarbandHeroDetail(warbandId, Number(unitId));
    return { source: freshSource, target: freshTarget };
  }

  return { source: freshSource };
}
