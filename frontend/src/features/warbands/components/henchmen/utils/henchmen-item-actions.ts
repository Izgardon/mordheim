import {
  addWarbandItem,
  createWarbandTrade,
  getWarbandHenchmenGroupDetail,
  getWarbandHeroDetail,
  updateWarbandHenchmenGroup,
  updateWarbandHero,
} from "../../../api/warbands-api";

import type { HenchmenGroup, WarbandHero } from "../../../types/warband-types";
import type { Item } from "../../../../items/types/item-types";

export async function sellHenchmenGroupItem(
  warbandId: number,
  group: HenchmenGroup,
  item: Item,
  sellQty: number,
  sellPrice: number,
): Promise<HenchmenGroup> {
  const currentItemIds = group.items.map((i) => i.id);
  const newItemIds = [...currentItemIds];

  let removed = 0;
  for (let i = newItemIds.length - 1; i >= 0 && removed < sellQty; i--) {
    if (newItemIds[i] === item.id) {
      newItemIds.splice(i, 1);
      removed++;
    }
  }

  if (removed === 0) {
    throw new Error("Item not found on this group.");
  }

  const updatedGroup = await updateWarbandHenchmenGroup(warbandId, group.id, {
    item_ids: newItemIds,
  } as any);

  await createWarbandTrade(warbandId, {
    action: "Sold",
    description: sellQty > 1 ? `${item.name} x ${sellQty}` : item.name,
    price: sellPrice,
  });

  return updatedGroup;
}

export async function moveHenchmenGroupItem(
  warbandId: number,
  group: HenchmenGroup,
  item: Item,
  moveQty: number,
  unitType: string,
  unitId: string,
): Promise<{ source: HenchmenGroup; target?: WarbandHero }> {
  const sourceItemIds = group.items.map((i) => i.id);
  const newSourceItemIds = [...sourceItemIds];

  let removed = 0;
  for (let i = newSourceItemIds.length - 1; i >= 0 && removed < moveQty; i--) {
    if (newSourceItemIds[i] === item.id) {
      newSourceItemIds.splice(i, 1);
      removed++;
    }
  }

  if (removed === 0) {
    throw new Error("Item not found on this group.");
  }

  await updateWarbandHenchmenGroup(warbandId, group.id, {
    item_ids: newSourceItemIds,
  } as any);

  if (unitType === "stash") {
    for (let i = 0; i < moveQty; i++) {
      await addWarbandItem(warbandId, item.id);
    }
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
  }

  const freshSource = await getWarbandHenchmenGroupDetail(warbandId, group.id);

  if (unitType === "heroes") {
    const freshTarget = await getWarbandHeroDetail(warbandId, Number(unitId));
    return { source: freshSource, target: freshTarget };
  }

  return { source: freshSource };
}
