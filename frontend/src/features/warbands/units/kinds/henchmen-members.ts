/**
 * Henchmen-only save work: new members' hire cost and recruit notes, their share of the group's
 * items, and the stash items they take (divergence 20 in the PR B characterisation).
 */
import { getHenchmenItemMultiplier } from "../../components/henchmen/utils/henchmen-cost";
import { toNullableNumber } from "../../utils/warband-utils";

import type { Item } from "@/features/items/types/item-types";
import type {
  HenchmanItemChoice,
  HenchmenGroupFormEntry,
} from "@/features/warbands/types/warband-types";

/** Base cost, XP cost and the per-henchman item breakdown, written on the recruit trade. */
export const buildRecruitNotes = (opts: {
  price: string;
  xp: string;
  items: Item[];
  henchmenCount: number;
  itemChoices?: HenchmanItemChoice[];
}): string => {
  const baseCost = toNullableNumber(opts.price) ?? 0;
  const xpRaw = toNullableNumber(opts.xp) ?? 0;
  const xpCost = xpRaw * 2;

  const lines: string[] = [];

  if (baseCost > 0) lines.push(`Base: ${baseCost} gc`);
  if (xpCost > 0) lines.push(`XP: ${xpRaw} x2 = ${xpCost} gc`);

  const itemParts: string[] = [];
  if (opts.itemChoices && opts.itemChoices.length > 0) {
    const itemNames = new Map<number, string>();
    for (const item of opts.items) {
      if (!itemNames.has(item.id)) itemNames.set(item.id, item.name);
    }
    for (const choice of opts.itemChoices) {
      const name = itemNames.get(choice.itemId) ?? `Item #${choice.itemId}`;
      const cost = choice.cost ?? 0;
      if (choice.action === "stash") {
        itemParts.push(`${name} (from stash)`);
      } else if (choice.action === "ignore") {
        itemParts.push(`${name} (ignored)`);
      } else if (cost > 0) {
        itemParts.push(`${name} (${cost} gc)`);
      } else {
        itemParts.push(name);
      }
    }
  } else {
    // No choices: every item is bought, one share per henchman.
    for (const { item, count } of countItems(opts.items).values()) {
      const perHenchman = getHenchmenItemMultiplier(count, opts.henchmenCount);
      if (perHenchman <= 0) continue;
      const label = perHenchman > 1 ? `${item.name} x${perHenchman}` : item.name;
      itemParts.push(item.cost ? `${label} (${item.cost * perHenchman} gc)` : label);
    }
  }
  if (itemParts.length > 0) {
    lines.push("Items: " + itemParts.join(", "));
  }

  return lines.join(". ");
};

/** Item counts in first-seen order (the recruit notes list items in that order). */
const countItems = (items: Item[]) => {
  const seen = new Map<number, { item: Item; count: number }>();
  for (const item of items) {
    const existing = seen.get(item.id);
    if (existing) {
      existing.count += 1;
    } else {
      seen.set(item.id, { item, count: 1 });
    }
  }
  return seen;
};

/** Item counts keyed by id; Object.values walks numeric keys ascending (pinned in the tests). */
const countItemsById = (items: Item[]) => {
  const counts: Record<number, { item: Item; count: number }> = {};
  for (const item of items) {
    if (counts[item.id]) {
      counts[item.id].count += 1;
    } else {
      counts[item.id] = { item, count: 1 };
    }
  }
  return counts;
};

/** The group's items plus a share for each new member (copies appended in ascending item id). */
export const computeItemsWithNewHenchmen = (group: {
  items: Item[];
  henchmen: { id?: number | null; itemChoices?: HenchmanItemChoice[] }[];
}): { id: number; cost: number | null }[] => {
  const toEntry = (item: Item) => ({ id: item.id, cost: item.cost ?? null });
  const newHenchmen = group.henchmen.filter((h) => !h.id);
  if (newHenchmen.length === 0) {
    return group.items.map(toEntry);
  }
  const baseCount = group.henchmen.length - newHenchmen.length;
  let items: Item[] = [...group.items];
  for (let i = 0; i < newHenchmen.length; i += 1) {
    const choices = newHenchmen[i].itemChoices;
    const currentCount = baseCount + i;
    if (currentCount <= 0 || items.length === 0) continue;
    const toAdd: Item[] = [];
    for (const { item, count } of Object.values(countItemsById(items))) {
      const toAddCount = choices
        ? choices.filter((c) => c.itemId === item.id && c.action !== "ignore").length
        : getHenchmenItemMultiplier(count, currentCount);
      for (let j = 0; j < toAddCount; j += 1) {
        toAdd.push(item);
      }
    }
    items = [...items, ...toAdd];
  }
  return items.map(toEntry);
};

/** Stash items picked "from stash" in the add-henchman dialog, to remove after the writes. */
export const collectStashRemovals = (
  groupForms: HenchmenGroupFormEntry[]
): { itemId: number; quantity: number }[] => {
  const removals: { itemId: number; quantity: number }[] = [];
  for (const group of groupForms) {
    if (!group.id) continue;
    const baseCount = group.henchmen.filter((h) => !!h.id).length;
    const newHenchmen = group.henchmen.filter((h) => !h.id);
    let items = [...group.items];
    for (let i = 0; i < newHenchmen.length; i += 1) {
      const choices = newHenchmen[i].itemChoices;
      if (!choices) continue;
      const currentCount = baseCount + i;
      if (currentCount <= 0 || items.length === 0) continue;
      const stashCounts: Record<number, number> = {};
      for (const choice of choices) {
        if (choice.action === "stash") {
          stashCounts[choice.itemId] = (stashCounts[choice.itemId] ?? 0) + 1;
        }
      }
      for (const [itemIdStr, qty] of Object.entries(stashCounts)) {
        removals.push({ itemId: Number(itemIdStr), quantity: qty });
      }
      // Advance the items for the next member, as computeItemsWithNewHenchmen does.
      const toAdd: Item[] = [];
      for (const { item } of Object.values(countItemsById(items))) {
        const toAddCount = choices.filter(
          (c) => c.itemId === item.id && c.action !== "ignore"
        ).length;
        for (let j = 0; j < toAddCount; j += 1) {
          toAdd.push(item);
        }
      }
      items = [...items, ...toAdd];
    }
  }
  return removals;
};

export const normalizeHenchmanCost = (value: unknown) => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    return toNullableNumber(value);
  }
  return null;
};

/** The `henchmen` list of the group PATCH: new members carry their cost and recruit notes. */
export const buildMembersPayload = (group: HenchmenGroupFormEntry) =>
  group.henchmen.map((h) => {
    const cost = normalizeHenchmanCost(h.cost);
    return {
      ...(h.id ? { id: h.id } : {}),
      name: h.name,
      kills: h.kills,
      dead: h.dead,
      ...(cost !== null ? { cost } : {}),
      ...(!h.id
        ? {
            item_notes: buildRecruitNotes({
              price: group.price,
              xp: group.xp,
              items: group.items,
              henchmenCount: group.henchmen.filter((x) => !!x.id).length,
              itemChoices: h.itemChoices,
            }),
          }
        : {}),
    };
  });
