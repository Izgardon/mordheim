import { matchesSearchQuery } from "@/lib/matches-search-query";

import type { WeaponMaterial } from "../types/item-types";
import { materialPrice } from "../utils/item-prices";
import { inStoreOrder, searchWords, storeCategory, type StoreCategory } from "./store-items";
import type { StoreOffer } from "./StoreRow";

/*
 * The store's material rows (weapon materials, William 20 Nov 2026: "i should search gromril
 * weapon then under that i choose a melee only weapon to make gromril"). A material is a row of
 * its own, "Gromril Weapon", under Melee; opening it picks the weapon, and the rest of the form is
 * the normal one. An item is never transformed, and buying a weapon never asks what it is made of.
 */

/** "Gromril Weapon": what the material's row is called. */
export const materialRowName = (material: WeaponMaterial) => `${material.name} Weapon`;

/** A weapon a material may be made into: its offer, its price through the material (null: rolled). */
export type MaterialWeapon = { offer: StoreOffer; price: number | null };

/**
 * The material rows the store shows now: under Melee (and All), found by the material's own name,
 * the row's name or "weapon", in the server's order. What I can buy hides one the warband isn't
 * usually allowed, as it hides an item.
 */
export function shownMaterials(
  materials: WeaponMaterial[],
  filters: { query: string; category: StoreCategory; onlyMine: boolean }
): WeaponMaterial[] {
  if (filters.category !== "all" && filters.category !== "melee") return [];
  return materials.filter(
    (material) =>
      (material.can_take || !filters.onlyMine) &&
      matchesSearchQuery(filters.query, materialRowName(material), material.name, "weapon")
  );
}

/**
 * Every melee weapon the store offers this warband, each priced through the material (the server's
 * price for the row it is offered at; null for a price that isn't known until its dice are rolled),
 * in the store's own order.
 */
export function materialWeapons(material: WeaponMaterial, offers: StoreOffer[]): MaterialWeapon[] {
  const melee = offers.filter((offer) => storeCategory(offer.item) === "melee");
  return inStoreOrder(
    melee.map((offer) => ({ offer, view: null })),
    ""
  ).map(({ offer }) => ({
    offer,
    price:
      offer.availability.cost == null
        ? null
        : materialPrice(offer.item, offer.availability, material),
  }));
}

/** The weapons whose name, kind, rules or tags answer what was typed in the picker. */
export const searchWeapons = (weapons: MaterialWeapon[], query: string) =>
  weapons.filter((weapon) => matchesSearchQuery(query, ...searchWords(weapon.offer.item)));
