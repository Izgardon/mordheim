import {
  prebattlePayload,
  prebattleValuesOf,
  type PrebattleRollValues,
} from "@/features/catalogue/components/PrebattleRollFields";

import type {
  Item,
  ItemRule,
  ItemRuleLink,
  ItemWritePayload,
  RuleTable,
} from "../types/item-types";
import {
  blankPriceRow,
  priceRowProblems,
  priceRowsOf,
  priceRowsPayload,
  type PriceRowDraft,
} from "./price-rows";

/**
 * The types the items form writes. Animal items come from the bestiary (one per beast, written by
 * its form), so the items form never offers them.
 */
export const ITEM_TYPE_OPTIONS = ["Weapon", "Armour", "Miscellaneous"];

/**
 * The subtypes a type picks from (the Wargear filter's too): an Animal item's is its beast's kind.
 * Any other type writes its own ("Poisons and Drugs" for a miscellaneous item).
 */
export const ITEM_SUBTYPE_OPTIONS: Record<string, string[]> = {
  Weapon: ["Melee", "Ranged", "Blackpowder"],
  Armour: ["Armour", "Shield", "Helmet", "Barding"],
  Animal: ["Mount", "Pet", "Creature"],
};

/** One D6 row as the form edits it. */
export type TableRowDraft = { roll: string; result: string };

/**
 * One of an item's rules as the form edits it: a shared rule (`ruleId`, its own wording
 * optional) or one of its own (a name and text, and its pre-battle roll), with an optional D6 table
 * (two columns). Any other table it carries (an imported profile, a second table) is kept as it is.
 */
export type RuleDraft = PrebattleRollValues & {
  key: number;
  ruleId: number | null;
  name: string;
  summary: string;
  text: string;
  d6: TableRowDraft[];
  kept: RuleTable[];
};

/**
 * What the item form edits. The variant (telling two book items of one name apart) and the search
 * words have no box (William, 7 Nov 2026: "remove search words box"): they are sent back as read.
 */
export type ItemFormValues = {
  name: string;
  variant: string;
  type: string;
  subtype: string;
  singleUse: boolean;
  flavour: string;
  strength: string;
  range: string;
  save: string;
  source: string;
  linkUrl: string;
  tags: string;
  notes: string;
  rules: RuleDraft[];
  prices: PriceRowDraft[];
};

export type ItemTextField = Exclude<keyof ItemFormValues, "singleUse" | "rules" | "prices">;

let nextKey = 1;

const isD6 = (table: RuleTable) =>
  table.columns.length === 2 || table.rows.every((row) => row.length === 2);

export const blankRule = (ruleId: number | null = null, name = ""): RuleDraft => ({
  key: nextKey++,
  ruleId,
  name,
  summary: "",
  text: "",
  d6: [],
  kept: [],
  prebattleRoll: "",
  prebattleText: "",
});

/**
 * A rule link as the form edits it. A shared rule keeps only the item's own wording: the summary
 * and text that differ from the shared rule's (`shared`, when the list is loaded).
 */
function ruleDraftOf(rule: ItemRuleLink, shared: Map<number, ItemRule>): RuleDraft {
  const [first, ...rest] = rule.table;
  const d6 =
    first && isD6(first)
      ? first.rows.map(([roll, result]) => ({ roll: roll ?? "", result: result ?? "" }))
      : [];
  const book = rule.rule_id ? shared.get(rule.rule_id) : undefined;
  return {
    key: nextKey++,
    ruleId: rule.rule_id,
    name: rule.name,
    summary: book && rule.summary === book.summary ? "" : rule.summary,
    text: book && rule.text === book.text ? "" : rule.text,
    d6,
    kept: first && isD6(first) ? rest : rule.table,
    ...prebattleValuesOf(rule.rule_id ? undefined : rule),
  };
}

/** An item's values for the form; a blank form (one Common price for everyone) for null. */
export function itemValuesOf(item: Item | null, shared: ItemRule[] = []): ItemFormValues {
  const rules = new Map(shared.map((rule) => [rule.id, rule]));
  return {
    name: item?.name ?? "",
    variant: item?.variant ?? "",
    type: item?.type ?? "",
    subtype: item?.subtype ?? "",
    singleUse: item?.single_use ?? false,
    flavour: item?.flavour ?? "",
    strength: item?.strength ?? "",
    range: item?.range ?? "",
    save: item?.save ?? "",
    source: item?.source ?? "",
    linkUrl: item?.link_url ?? "",
    tags: (item?.tags ?? []).join(", "),
    notes: item?.notes ?? "",
    rules: (item?.rules ?? []).map((rule) => ruleDraftOf(rule, rules)),
    prices:
      item && item.availabilities?.length ? priceRowsOf(item.availabilities) : [blankPriceRow()],
  };
}

/** The types the form offers: the three, and an edited item's own if it is another. */
export function itemTypeOptions(item: Item | null) {
  const current = item?.type?.trim();
  return current && !ITEM_TYPE_OPTIONS.includes(current)
    ? [current, ...ITEM_TYPE_OPTIONS]
    : ITEM_TYPE_OPTIONS;
}

const tablesOf = (rule: RuleDraft): RuleTable[] => {
  const rows = rule.d6.filter((row) => row.roll.trim() || row.result.trim());
  const d6 = rows.length
    ? [{ columns: ["D6", "Result"], rows: rows.map((row) => [row.roll.trim(), row.result.trim()]) }]
    : [];
  return [...d6, ...rule.kept];
};

/** The body an item create or edit sends (an edit sends no campaign_id). */
export function itemPayload(values: ItemFormValues): ItemWritePayload {
  return {
    name: values.name.trim(),
    variant: values.variant.trim(),
    type: values.type.trim(),
    subtype: values.subtype.trim(),
    single_use: values.type === "Miscellaneous" ? values.singleUse : false,
    flavour: values.flavour.trim(),
    strength: values.strength.trim() || null,
    range: values.range.trim() || null,
    save: values.save.trim() || null,
    source: values.source.trim(),
    link_url: values.linkUrl.trim(),
    tags: values.tags
      .split(",")
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean),
    notes: values.notes.trim(),
    rules: values.rules.map((rule) => ({
      rule_id: rule.ruleId,
      name: rule.ruleId ? "" : rule.name.trim(),
      summary: rule.summary.trim(),
      text: rule.text.trim(),
      table: tablesOf(rule),
      ...prebattlePayload(rule.ruleId ? prebattleValuesOf(undefined) : rule),
    })),
    availabilities: priceRowsPayload(values.prices),
  };
}

export const NO_PRICE_HINT = "Add at least one price.";
export const RULE_NAME_HINT = "A rule of the item's own needs a name.";

/**
 * What stops a save before it is sent, the server's own limits, each under its field as the
 * server's refusals are; a missing name or type is the line under the form.
 */
export function itemFormProblems(values: ItemFormValues): {
  line: string | null;
  fields: Record<string, string>;
} {
  if (!values.name.trim() || !values.type.trim()) {
    return { line: "Name and type are required.", fields: {} };
  }
  if (values.prices.length === 0) {
    return { line: null, fields: { availabilities: NO_PRICE_HINT } };
  }
  const fields = priceRowProblems(values.prices, "availabilities");
  values.rules.forEach((rule, index) => {
    if (!rule.ruleId && !rule.name.trim()) fields[`rules.${index}.name`] = RULE_NAME_HINT;
  });
  return { line: null, fields };
}
