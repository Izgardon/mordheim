/**
 * Reading a unit's companions from its payload (the bestiary rewrite, step 4). The server works
 * out the mount, the pets and what a mount changes; these helpers only read what it sent.
 */
import type { Item } from "@/features/items/types/item-types";
import type { UnitCompanionFields, CreatureGroupFields } from "../types/companion-types";

/** A copy of a mount or pet switched on for its unit (a campaign's later change of kind: not). */
export const isSwitchedOn = (item: Pick<Item, "companion" | "beast_kind">) =>
  Boolean(item.companion) && (item.beast_kind === "mount" || item.beast_kind === "pet");

/** A unit's switched-on mounts as its item rows show them (only copies of `itemId` when given). */
export const ridden = (
  items: Pick<Item, "id" | "companion" | "beast_kind">[] = [],
  itemId?: number
) =>
  items.filter(
    (item) =>
      isSwitchedOn(item) &&
      item.beast_kind === "mount" &&
      (itemId === undefined || item.id === itemId)
  ).length;

type MountedUnit = UnitCompanionFields & {
  items?: Pick<Item, "id" | "companion" | "beast_kind">[];
  henchmen?: unknown[];
};

/**
 * What the unit's mounts add to the warband rating, as the server counts them: a rider's first
 * mount once; a group one per living member at most, each at its first mount's bonus (the payload
 * names only the group's first mount, so a group riding two kinds counts the first one's).
 */
export function unitMountBonus(unit: MountedUnit) {
  const bonus = unit.mount?.rating_bonus ?? 0;
  if (!unit.henchmen) return bonus;
  return Math.min(ridden(unit.items), unit.henchmen.length) * bonus;
}

/** A henchmen group recruited from a creature (it can go back to its item). */
export const isCreatureGroup = (group: CreatureGroupFields) =>
  group.source_beast_id != null || group.beast_kind === "creature";
