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

import type { HenchmenGroup, WarbandHiredSword, WarbandHero } from "../../../types/warband-types";
import type { Item } from "../../../../items/types/item-types";

export async function sellHiredSwordItem(
  warbandId: number,
  hiredSword: WarbandHiredSword,
  item: Item,
  sellQty: number,
  sellPrice: number,
): Promise<WarbandHiredSword> {
  const currentItemIds = hiredSword.items.map((i) => i.id);
  const newItemIds = [...currentItemIds];

  let removed = 0;
  for (let i = newItemIds.length - 1; i >= 0 && removed < sellQty; i--) {
    if (newItemIds[i] === item.id) {
      newItemIds.splice(i, 1);
      removed++;
    }
  }

  if (removed === 0) {
    throw new Error("Item not found on this hired sword.");
  }

  const updated = await updateWarbandHiredSword(warbandId, hiredSword.id, {
    name: hiredSword.name,
    unit_type: hiredSword.unit_type,
    race: hiredSword.race_id ?? null,
    price: hiredSword.price,
    upkeep_price: hiredSword.upkeep_price ?? 0,
    xp: hiredSword.xp,
    item_ids: newItemIds,
  });

  await createWarbandTrade(warbandId, {
    action: "Sold",
    description: sellQty > 1 ? `${item.name} x ${sellQty}` : item.name,
    price: sellPrice,
  });

  return updated;
}

export async function moveHiredSwordItem(
  warbandId: number,
  hiredSword: WarbandHiredSword,
  item: Item,
  moveQty: number,
  unitType: string,
  unitId: string,
): Promise<{ source: WarbandHiredSword; target?: WarbandHero | WarbandHiredSword | HenchmenGroup }> {
  const sourceItemIds = hiredSword.items.map((i) => i.id);
  const newSourceItemIds = [...sourceItemIds];

  let removed = 0;
  for (let i = newSourceItemIds.length - 1; i >= 0 && removed < moveQty; i--) {
    if (newSourceItemIds[i] === item.id) {
      newSourceItemIds.splice(i, 1);
      removed++;
    }
  }

  if (removed === 0) {
    throw new Error("Item not found on this hired sword.");
  }

  await updateWarbandHiredSword(warbandId, hiredSword.id, {
    name: hiredSword.name,
    unit_type: hiredSword.unit_type,
    race: hiredSword.race_id ?? null,
    price: hiredSword.price,
    upkeep_price: hiredSword.upkeep_price ?? 0,
    xp: hiredSword.xp,
    item_ids: newSourceItemIds,
  });

  if (unitType === "stash") {
    await addWarbandItem(warbandId, item.id, { quantity: moveQty });
  } else if (unitType === "heroes") {
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
  }

  const freshSource = await getWarbandHiredSwordDetail(warbandId, hiredSword.id);

  if (unitType === "heroes") {
    const freshTarget = await getWarbandHeroDetail(warbandId, Number(unitId));
    return { source: freshSource, target: freshTarget };
  }

  if (unitType === "hiredswords") {
    const freshTarget = await getWarbandHiredSwordDetail(warbandId, Number(unitId));
    return { source: freshSource, target: freshTarget };
  }

  if (unitType === "henchmen") {
    const freshTarget = await getWarbandHenchmenGroupDetail(warbandId, Number(unitId));
    return { source: freshSource, target: freshTarget };
  }

  return { source: freshSource };
}
