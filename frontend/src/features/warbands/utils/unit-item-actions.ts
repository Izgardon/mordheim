import { sellWarbandItem, transferWarbandItem } from "../api/warbands-api";

import type {
  HenchmenGroup,
  WarbandHero,
  WarbandHiredSword,
  WarbandItemMutationResponse,
} from "../types/warband-types";
import type { Item } from "../../items/types/item-types";

type ItemEntry = { id: number; cost?: number | null };
type UnitWithItems = { id: number; items: ItemEntry[] };

export type UnitType = "heroes" | "hiredswords" | "henchmen";

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

function toApiUnitType(unitType: UnitType | "stash") {
  switch (unitType) {
    case "heroes":
      return "hero";
    case "hiredswords":
      return "hired_sword";
    case "henchmen":
      return "henchmen_group";
    default:
      return "stash";
  }
}

export async function sellUnitItem<U extends UnitWithItems>(opts: {
  warbandId: number;
  unit: U;
  item: Item;
  sellQty: number;
  sellPrice: number;
  unitType: UnitType;
}): Promise<WarbandItemMutationResponse> {
  const { warbandId, unit, item, sellQty, sellPrice, unitType } = opts;
  return sellWarbandItem(warbandId, {
    source_type: toApiUnitType(unitType),
    source_id: unit.id,
    item_id: item.id,
    quantity: sellQty,
    price: sellPrice,
  });
}

export async function moveUnitItem<U extends UnitWithItems>(opts: {
  warbandId: number;
  unit: U;
  item: Item;
  moveQty: number;
  targetUnitType: string;
  targetUnitId: string;
  unitType: UnitType;
}): Promise<WarbandItemMutationResponse> {
  const { warbandId, unit, item, moveQty, targetUnitType, targetUnitId, unitType } = opts;
  return transferWarbandItem(warbandId, {
    source_type: toApiUnitType(unitType),
    source_id: unit.id,
    target_type: toApiUnitType(targetUnitType as UnitType | "stash"),
    target_id: targetUnitType === "stash" ? null : Number(targetUnitId),
    item_id: item.id,
    quantity: moveQty,
  });
}
