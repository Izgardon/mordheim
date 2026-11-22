import type { Item, ItemRuleLink, RuleTable } from "../types/item-types";
import { beastOf } from "./item-listing";

const MARKER = /\{\{table:(\d+)\}\}/g;

/** A rule's name, or "Rule" for the unnamed one that is simply the item's own text. */
export const ruleName = (rule: Pick<ItemRuleLink, "name">) => rule.name.trim() || "Rule";

/**
 * A rule's text cut where its tables stand (`{{table:N}}`): text and tables in reading order; a
 * table no marker names comes after the text.
 */
export function ruleParts(
  rule: Pick<ItemRuleLink, "text" | "summary" | "table">
): ({ kind: "text"; text: string } | { kind: "table"; table: RuleTable })[] {
  const text = rule.text || rule.summary;
  const parts: ({ kind: "text"; text: string } | { kind: "table"; table: RuleTable })[] = [];
  const placed = new Set<number>();
  let last = 0;
  for (const match of text.matchAll(MARKER)) {
    const before = text.slice(last, match.index).trim();
    if (before) parts.push({ kind: "text", text: before });
    const index = Number(match[1]) - 1;
    const table = rule.table[index];
    if (table) {
      parts.push({ kind: "table", table });
      placed.add(index);
    }
    last = (match.index ?? 0) + match[0].length;
  }
  const rest = text.slice(last).trim();
  if (rest) parts.push({ kind: "text", text: rest });
  rule.table.forEach((table, index) => {
    if (!placed.has(index)) parts.push({ kind: "table", table });
  });
  return parts;
}

/** A rule as one line of plain text (the battle sheet): its text without the table markers. */
export const plainRuleText = (rule: Pick<ItemRuleLink, "text" | "summary">) =>
  (rule.text || rule.summary)
    .replace(MARKER, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

/**
 * An item's rules as lines of plain text (a unit's card, the battle sheet): its own and shared
 * rules, then an Animal item's beast's specials, where most beasts keep their rules.
 */
export const itemRuleLines = (item: Pick<Item, "rules" | "type" | "bestiary_entry">) => [
  ...(item.rules ?? []).map((rule) => ({ name: ruleName(rule), text: plainRuleText(rule) })),
  ...(beastOf(item)?.specials ?? []).map((special) => ({
    name: special.name,
    text: special.description,
  })),
];

/** An Animal item's beast's profile, when it has one (null for any other item). */
export const beastProfile = (item: Pick<Item, "type" | "bestiary_entry">) => {
  const beast = beastOf(item);
  return beast?.has_profile ? beast : null;
};
