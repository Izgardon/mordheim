import { itemName } from "@/features/items/store/store-items";
import type { Item, ItemRule } from "@/features/items/types/item-types";
import { whoLine } from "@/features/items/utils/item-prices";
import { inPlayOnly } from "@/features/reference/in-play";
import type { SkillGroup } from "@/features/skills/types/skill-types";

import { ranked, words, type SearchHit } from "./search-ranking";

/**
 * The shared wargear rules (Experimental Technology, Map) an item in play holds, by name or text,
 * each naming its items (or how many) and opening Wargear searched for it, its first item open.
 */
export function itemRuleHits(rules: ItemRule[], items: Item[], needle: string): SearchHit[] {
  const holders = new Map<number, Item[]>();
  for (const item of [...items].sort((a, b) => itemName(a).localeCompare(itemName(b)))) {
    for (const link of item.rules ?? []) {
      if (link.rule_id !== null)
        holders.set(link.rule_id, [...(holders.get(link.rule_id) ?? []), item]);
    }
  }
  return ranked(
    rules
      .filter((rule) => holders.has(rule.id))
      .map((rule) => ({
        entry: rule,
        name: rule.name,
        text: words(`${rule.summary} ${rule.text}`.replace(/\{\{table:\d+\}\}/g, " ")),
      })),
    needle
  ).map(({ entry, snippet }) => {
    const held = holders.get(entry.id) ?? [];
    return {
      key: `item-rule-${entry.id}`,
      title: entry.name,
      meta: held.length > 3 ? `${held.length} items` : held.map(itemName).join(", "),
      snippet,
      to: `items?q=${encodeURIComponent(entry.name)}&open=${held[0]?.id ?? ""}`,
    };
  });
}

/** The skill groups in play by name (or their note), each saying who learns from it, opening its row. */
export function skillGroupHits(groups: SkillGroup[], needle: string): SearchHit[] {
  return ranked(
    inPlayOnly(groups).map((group) => ({
      entry: group,
      name: group.name,
      text: words(group.learn_note),
    })),
    needle
  ).map(({ entry, snippet }) => ({
    key: `skill-group-${entry.id}`,
    title: entry.name,
    meta: whoLine(entry),
    snippet,
    to: `skills?group=${entry.id}`,
  }));
}
