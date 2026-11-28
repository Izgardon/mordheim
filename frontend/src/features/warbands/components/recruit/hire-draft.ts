import type { PurchaseLine } from "@/features/items/api/purchase";
import { countLabel, lineName } from "@/features/warband-templates/template-view";

import type { TemplateFighter, TemplateLine, TemplateList } from "../../types/hire-template-types";

/*
 * A hire from the warband's template (the templates plan, phase 2) as the Add hero, Add group and
 * camp's Recruit forms hold it: the fighter picked, the kit picked from his lists while list
 * prices are open, and the tally's prices, which the player may change. The server fills the
 * rest from the fighter and adds the "1st free" items; these helpers only shape what is sent and what
 * warns.
 */

/**
 * A line picked from his lists: one copy, or a brace at its brace price. A line selling a weapon
 * material (weapon materials) carries the weapon picked on it (`itemId`), from the other melee
 * weapons on the same list.
 */
export type KitPick = { lineId: number; brace: boolean; itemId?: number };

export const pickKey = (pick: KitPick) =>
  `${pick.lineId}${pick.itemId ? `-${pick.itemId}` : ""}${pick.brace ? "-brace" : ""}`;

/** What a pick buys: the weapon picked on a material line, else the line's item. */
export const pickItemId = (pick: KitPick, line: TemplateLine) =>
  pick.itemId ?? line.item?.id ?? null;

/** The lines of his lists, in his lists' order, each once. */
export function fighterLines(fighter: TemplateFighter, lists: TemplateList[]): TemplateLine[] {
  const seen = new Set<number>();
  return fighter.lists.flatMap((key) =>
    (lists.find((list) => list.key === key)?.lines ?? []).filter((line) =>
      seen.has(line.id) ? false : (seen.add(line.id), true)
    )
  );
}

/**
 * His lists' lines grouped by the item's type ("Weapon", "Armour", "Miscellaneous"), each group
 * in the lists' own order and the groups in the order they first appear (William, 12 Nov).
 */
export function linesByType(lines: TemplateLine[]): [string, TemplateLine[]][] {
  const groups = new Map<string, TemplateLine[]>();
  for (const line of lines) {
    // a line naming a weapon material sits with the weapons (weapon materials)
    const type = line.item?.type || (line.material ? "Weapon" : "Other");
    groups.set(type, [...(groups.get(type) ?? []), line]);
  }
  return [...groups];
}

/** "Mercenary list" or "Pit fighter list, Special equipment": the lists he buys from. */
export const listNames = (fighter: TemplateFighter, lists: TemplateList[]) =>
  fighter.lists
    .map((key) => lists.find((list) => list.key === key)?.name)
    .filter(Boolean)
    .join(", ");

/** "1 of 0–2": what the warband has of him, against how many it may have. */
export const haveText = (fighter: TemplateFighter) =>
  `${fighter.have.count} of ${countLabel(fighter)}`;

/** Past his most (a warning, never a block): adding `adding` more (a hero 1, a group its models). */
export function overCount(fighter: TemplateFighter, adding: number): string | null {
  const max = fighter.max_count;
  if (max === null) return null;
  const have = fighter.have.count;
  if (fighter.kind === "hero") {
    return have + adding > max ? `Already ${have} of ${max}.` : null;
  }
  return have + adding > max
    ? `That makes ${have + adding} of ${max}. You can still add them.`
    : null;
}

/** "Warhound 1", "Warhound 2": a creature's copies, named as the server names a beast's (`beasts.beast_names`). */
export const numbered = (name: string) => (index: number) => `${name} ${index + 1}`;

/**
 * A creature on his list (the shared Animal rule, or his own "Animal (Baneworm)") names his models
 * as a bought beast's are, "Giant Rat 1", each still editable; anyone else's start blank.
 */
export const memberPrefill = (fighter: TemplateFighter) =>
  fighter.rules.some((rule) => rule.name === "Animal" || rule.name.startsWith("Animal ("))
    ? numbered(fighter.name)
    : undefined;

/** A group past its size (a warning). */
export function overGroup(fighter: TemplateFighter, models: number): string | null {
  const max = fighter.group_max;
  return max !== null && models > max ? `That takes the group over its size of ${max}.` : null;
}

/** "Sword", or the list's own name for it: "Jambiya (Dagger)" (the Warbands page's). */
export const lineLabel = lineName;

/** "Gromril Sword": what a pick on a material line reads as, from the weapon picked on it. */
export function pickLabel(line: TemplateLine, pick: KitPick): string {
  const chosen = line.material?.choices.find((choice) => choice.item.id === pick.itemId);
  return chosen ? `${line.material?.prefix} ${chosen.item.name}` : lineLabel(line);
}

/** What a material line's pick costs at list price: the line's price for the weapon picked. */
export const materialPickPrice = (line: TemplateLine, itemId: number) =>
  line.material?.choices.find((choice) => choice.item.id === itemId)?.price ?? null;

/** What a pick costs at list price: the line's price, or its brace price; null when the player types it. */
export const listPrice = (line: TemplateLine, brace: boolean, itemId?: number) => {
  if (line.material) return itemId ? materialPickPrice(line, itemId) : null;
  return brace ? line.brace_cost : line.cost;
};

/** Past a per-warband limit, with what this hire adds (`copies`): a warning. */
export function overWarbandMax(line: TemplateLine, copies: number): string | null {
  if (line.warband_max === null) return null;
  const held = line.held ?? 0;
  return held + copies > line.warband_max
    ? `At most ${line.warband_max} in the warband: it would hold ${held + copies}.`
    : null;
}

const whole = (value: string) => Math.max(0, Math.trunc(Number(value) || 0));

/**
 * The batch's purchases for the hire (its create index 0): each pick at the tally's price, one
 * copy each (a group buys one for every member; the server makes it a loadout row). A brace is
 * two copies, its price split between them so the total is what the tally says.
 */
export function kitPurchases(
  picks: KitPick[],
  prices: Record<string, string>,
  lines: TemplateLine[],
  createIndex = 0
): Array<{ create_index: number } & PurchaseLine> {
  return picks.flatMap((pick) => {
    const line = lines.find((entry) => entry.id === pick.lineId);
    if (!line) return [];
    const itemId = pickItemId(pick, line);
    if (itemId === null) return [];
    const total = whole(prices[pickKey(pick)] ?? "");
    const halves = pick.brace ? [Math.floor(total / 2), total - Math.floor(total / 2)] : [total];
    return halves.map((price) => ({
      create_index: createIndex,
      item_id: itemId,
      quantity: 1,
      price,
      availability_id: null,
      is_buying: true,
      ...(line.material ? { material: line.material.slug } : {}),
    }));
  });
}

/** The tally's total: his cost (each member's) and every pick's price, the picks a group's for each member. */
export function tallyTotal(
  cost: string,
  members: number,
  picks: KitPick[],
  prices: Record<string, string>
) {
  const kit = picks.reduce((sum, pick) => sum + whole(prices[pickKey(pick)] ?? ""), 0);
  return (whole(cost) + kit) * Math.max(1, members);
}

/** A pick whose price the player hasn't typed yet (a line priced "3 × price"). */
export const unpriced = (picks: KitPick[], prices: Record<string, string>) =>
  picks.some((pick) => (prices[pickKey(pick)] ?? "").trim() === "");
