import type { PurchaseLine } from "@/features/items/api/purchase";
import { countLabel, lineName } from "@/features/warband-templates/template-view";

import type { TemplateFighter, TemplateLine, TemplateList } from "../../types/hire-template-types";

/*
 * A hire from the warband's template (the templates plan, phase 2) as the Add hero, Add group and
 * camp's Recruit forms hold it: the fighter picked, the kit picked from his lists while list
 * prices are open, and the tally's prices, which the player may change. The server fills the
 * rest from the fighter and adds the free dagger; these helpers only shape what is sent and what
 * warns.
 */

/** A line picked from his lists: one copy, or a brace at its brace price. */
export type KitPick = { lineId: number; brace: boolean };

export const pickKey = (pick: KitPick) => `${pick.lineId}${pick.brace ? "-brace" : ""}`;

/** The lines of his lists, in his lists' order, each once. */
export function fighterLines(fighter: TemplateFighter, lists: TemplateList[]): TemplateLine[] {
  const seen = new Set<number>();
  return fighter.lists.flatMap((key) =>
    (lists.find((list) => list.key === key)?.lines ?? []).filter((line) =>
      seen.has(line.id) ? false : (seen.add(line.id), true)
    )
  );
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

/** A group past its size (a warning). */
export function overGroup(fighter: TemplateFighter, models: number): string | null {
  const max = fighter.group_max;
  return max !== null && models > max ? `That takes the group over its size of ${max}.` : null;
}

/** "Sword", or the list's own name for it: "Jambiya (Dagger)" (the Warbands page's). */
export const lineLabel = lineName;

/** What a pick costs at list price: the line's price, or its brace price; null when the player types it. */
export const listPrice = (line: TemplateLine, brace: boolean) =>
  brace ? line.brace_cost : line.cost;

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
    const total = whole(prices[pickKey(pick)] ?? "");
    const halves = pick.brace ? [Math.floor(total / 2), total - Math.floor(total / 2)] : [total];
    return halves.map((price) => ({
      create_index: createIndex,
      item_id: line.item.id,
      quantity: 1,
      price,
      availability_id: null,
      is_buying: true,
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
