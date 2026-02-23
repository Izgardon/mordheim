import {
  addWarbandItem,
  createWarbandTrade,
  updateWarbandHenchmenGroup,
} from "../../../api/warbands-api";

import type { HenchmenGroup } from "../../../types/warband-types";
import type { Item } from "../../../../items/types/item-types";

const getAliveCount = (group: HenchmenGroup): number =>
  (group.henchmen ?? []).filter((h) => !h.dead).length || 1;

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

  const aliveCount = getAliveCount(group);
  const totalQty = sellQty * aliveCount;
  const totalPrice = sellPrice * aliveCount;
  const description =
    aliveCount > 1
      ? `${item.name} x${totalQty} (${sellQty} per henchman)`
      : sellQty > 1
        ? `${item.name} x${sellQty}`
        : item.name;

  await createWarbandTrade(warbandId, {
    action: "Sold",
    description,
    price: totalPrice,
  });

  return updatedGroup;
}

export async function unequipHenchmenGroupItem(
  warbandId: number,
  group: HenchmenGroup,
  item: Item,
  unequipQty: number,
): Promise<HenchmenGroup> {
  const currentItemIds = group.items.map((i) => i.id);
  const newItemIds = [...currentItemIds];

  let removed = 0;
  for (let i = newItemIds.length - 1; i >= 0 && removed < unequipQty; i--) {
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

  const aliveCount = getAliveCount(group);
  const totalQty = unequipQty * aliveCount;
  await addWarbandItem(warbandId, item.id, { quantity: totalQty });

  return updatedGroup;
}
