import { matchesSearchQuery } from "@/lib/matches-search-query";

import type { WeaponMaterial } from "../types/item-types";
import { materialPrice } from "../utils/item-prices";
import { inStoreOrder, searchWords, storeCategory, type StoreCategory } from "./store-items";
import type { HisMaterialLine } from "./his-list";
import type { StoreOffer } from "./StoreRow";

/*
 * The store's material rows (weapon materials, William 20 Nov 2026: "i should search gromril
 * weapon then under that i choose a melee only weapon to make gromril"). A material is a row of
 * its own, "Gromril Weapon", under Melee; opening it picks the weapon, and the rest of the form is
 * the normal one. An item is never transformed, and buying a weapon never asks what it is made of.
 */

/** "Gromril Weapon": what the material's row is called, unless a list of his names it its own way. */
export const materialRowName = (material: WeaponMaterial) => `${material.name} Weapon`;

/** A weapon a material may be made into: its offer, its price through the material (null: rolled). */
export type MaterialWeapon = { offer: StoreOffer; price: number | null };

/** A material's row: the material as the server offers it, the name it reads as, and its weapons. */
export type MaterialRowView = { material: WeaponMaterial; name: string; weapons: MaterialWeapon[] };

export type MaterialFilters = { query: string; category: StoreCategory; onlyMine: boolean };

/** Whether the filters let a material's row show: under Melee (and All), found by its name or "weapon". */
function shown(material: WeaponMaterial, name: string, filters: MaterialFilters): boolean {
  if (filters.category !== "all" && filters.category !== "melee") return false;
  if (!material.can_take && filters.onlyMine) return false;
  return matchesSearchQuery(filters.query, name, material.name, "weapon");
}

/**
 * The material rows the store shows now, in the server's order. What I can buy hides one the
 * warband isn't usually allowed, as it hides an item. On His list (`his`) only the materials his
 * lists sell show, as his list names them, and each offers the other melee weapons on that same
 * list at the line's own price for them (the server's), never every melee weapon in play.
 */
export function materialRows(
  materials: WeaponMaterial[],
  offers: StoreOffer[],
  filters: MaterialFilters,
  his: HisMaterialLine[] | null = null
): MaterialRowView[] {
  const byId = new Map(offers.map((offer) => [offer.item.id, offer]));
  if (his === null) {
    return materials.flatMap((material) => {
      const name = materialRowName(material);
      return shown(material, name, filters)
        ? [{ material, name, weapons: meleeWeapons(material, offers) }]
        : [];
    });
  }
  return his.flatMap((line) => {
    const material = materials.find((row) => row.slug === line.slug);
    if (!material || !shown(material, line.name, filters)) return [];
    const weapons = line.choices.flatMap(({ itemId, price }) => {
      const offer = byId.get(itemId);
      return offer ? [{ offer, price }] : [];
    });
    return [{ material, name: line.name, weapons }];
  });
}

/**
 * Every melee weapon the store offers this warband, each priced through the material (the server's
 * price for the row it is offered at; null for a price that isn't known until its dice are rolled),
 * in the store's own order.
 */
function meleeWeapons(material: WeaponMaterial, offers: StoreOffer[]): MaterialWeapon[] {
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
