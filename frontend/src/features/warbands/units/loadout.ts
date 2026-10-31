import type { Item } from "@/features/items/types/item-types";

import type { GapReason, Henchman, HenchmenGroup } from "../types/warband-types";

/**
 * Henchmen loadouts: a group's items are what every member carries, one copy each; a member who
 * lacks one has a gap. The server counts (`carriers`, `loadout_each`, `loadout_total`); these only
 * word what it sent.
 */

const REASON: Record<GapReason, string> = {
  lost: "lost after the last battle",
  used: "used up in the last battle",
  kit_taken: "his kit went to the stash",
  short: "joined without it",
};

/** "Each carries Sword, Light Armour, Sling" (or "Each carries nothing"). */
export const eachCarries = (group: Pick<HenchmenGroup, "items">) =>
  `Each carries ${group.items.length ? group.items.map((item) => item.name).join(", ") : "nothing"}`;

/** "Loadout 45 gc each · 180 gc": one member's loadout, then the copies the group holds. */
export const loadoutLine = (group: Pick<HenchmenGroup, "loadout_each" | "loadout_total">) =>
  `Loadout ${group.loadout_each ?? 0} gc each · ${group.loadout_total ?? 0} gc`;

/** One of a member's gaps with the row it names: what he lacks, and why. */
export type MemberGap = { id: number; row: Item; reason: GapReason; left: boolean; why: string };

export function memberGaps(group: Pick<HenchmenGroup, "items">, member: Henchman): MemberGap[] {
  const rows = new Map(group.items.map((item) => [item.row_id, item]));
  return (member.gaps ?? []).flatMap((gap) => {
    const row = rows.get(gap.row_id);
    return row
      ? [{ id: gap.id, row, reason: gap.reason, left: gap.left, why: REASON[gap.reason] }]
      : [];
  });
}

/** "Skritt has no Horse (lost after the last battle)." */
export const gapLine = (member: Pick<Henchman, "name">, gap: MemberGap) =>
  `${member.name || "He"} has no ${gap.row.name} (${gap.why}).`;

/** Why the next battle leaves him out at first: his kit went to the stash (null when it didn't). */
export function sitsOut(group: Pick<HenchmenGroup, "items">, member: Henchman) {
  const taken = memberGaps(group, member).filter((gap) => gap.reason === "kit_taken");
  return taken.length
    ? `His kit went to the stash (${taken.map((gap) => gap.row.name).join(", ")})`
    : null;
}

/** The rows a member carries, for his share: what goes to the stash when he leaves with it. */
export function memberShare(group: Pick<HenchmenGroup, "items">, member: Pick<Henchman, "gaps">) {
  const lacking = new Set((member.gaps ?? []).map((gap) => gap.row_id));
  return group.items.filter((item) => item.row_id === undefined || !lacking.has(item.row_id));
}

/** How many copies of a stash item a group takes when equipped: one each, up to what is there. */
export const copiesForGroup = (group: Pick<HenchmenGroup, "henchmen">, inStash: number) =>
  Math.max(1, Math.min(inStash, group.henchmen.filter((member) => !member.dead).length));
