import { inPlayOnly } from "@/features/reference/in-play";

import type {
  TemplateFighter,
  TemplateLine,
  TemplateRule,
  TemplateSpellType,
  TemplateWho,
  WarbandTemplate,
  WarbandTemplateSummary,
} from "./types/template-types";

/** One row of the Warbands page: a warband type in play, and the template it uses. */
export type TemplateTypeRow = {
  id: string;
  typeName: string;
  template: WarbandTemplateSummary;
  /** The variant the type always is; "" when the player picks one. */
  variant: string;
};

/**
 * Each warband type with a template, in play in the campaign (the reference pages' scoping: its
 * template's setting and its own), by name: a template serving four types gives four rows.
 */
export function typeRows(templates: WarbandTemplateSummary[]): TemplateTypeRow[] {
  const types = inPlayOnly(templates).flatMap((template) =>
    inPlayOnly(template.types)
      .filter((type) => !type.archived)
      .map((type) => ({ template, type }))
  );
  const named = new Map<string, number>();
  types.forEach(({ type }) => named.set(type.name, (named.get(type.name) ?? 0) + 1));
  return types
    .map(({ template, type }) => ({
      id: `${template.id}-${type.id}`,
      // two types of one name ("Night Goblins") are told apart by their source, as the type picker does
      typeName:
        (named.get(type.name) ?? 0) > 1 && type.source_code
          ? `${type.name} (${type.source_code})`
          : type.name,
      template,
      variant: type.variant,
    }))
    .sort((a, b) => a.typeName.localeCompare(b.typeName) || a.id.localeCompare(b.id));
}

/** The rule pills for a variant: every variant's, the variant's own, and a type's own (Ostermark). */
export function rulesFor(template: WarbandTemplate, variant: string): TemplateRule[] {
  const keys = new Set(template.variants.map((entry) => entry.key));
  return template.rules.filter(
    (rule) => !rule.variant || rule.variant === variant || !keys.has(rule.variant)
  );
}

/** His skill groups in the variant: its own table where it has one. */
export const skillsFor = (fighter: TemplateFighter, variant: string) =>
  fighter.variant_changes[variant]?.skill_types ?? fighter.skill_types;

/** "1", "0–2", "any" or "2+": how many of him a warband may have. */
export function countLabel(fighter: Pick<TemplateFighter, "min_count" | "max_count">) {
  const { min_count: min, max_count: max } = fighter;
  if (max === null) return min > 0 ? `${min}+` : "any";
  return min === max ? String(max) : `${min}–${max}`;
}

/** "groups of 1–5" for henchmen; nothing for a hero. */
export function groupLabel(fighter: Pick<TemplateFighter, "group_min" | "group_max">) {
  const { group_min: min, group_max: max } = fighter;
  if (max === null) return "";
  return min === null || min === max ? `groups of ${max}` : `groups of ${min}–${max}`;
}

/** A list line's price: "1st free / 2 gc", "15 gc, brace 30", "3 × price", "200 gc +10D6". */
export function priceLabel(
  line: Pick<TemplateLine, "cost" | "cost_note" | "first_free" | "brace_cost">
) {
  if (line.cost === null) return line.cost_note || "–";
  const base = line.first_free ? `1st free / ${line.cost} gc` : `${line.cost} gc`;
  const brace = line.brace_cost !== null ? `, brace ${line.brace_cost}` : "";
  return `${base}${line.cost_note ? ` ${line.cost_note}` : ""}${brace}`;
}

const listed = (names: string[]) =>
  names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0];

/** Who may take a line: "Heroes only", "Gaoler only", "Heroes and Corsairs only", "Not Questing Knight". */
export function whoLabel(who: TemplateWho, fighters: Pick<TemplateFighter, "key" | "name">[]) {
  const named = (keys: string[] = []) =>
    keys.map((key) => fighters.find((fighter) => fighter.key === key)?.name ?? key);
  if (who.except?.length) return `Not ${listed(named(who.except))}`;
  const parts = [...(who.heroes ? ["Heroes"] : []), ...named(who.fighters)];
  return parts.length ? `${listed(parts)} only` : "";
}

/** The line's item as the list names it: "Jambiya (Dagger)", or the item's own name. */
export const lineName = (line: Pick<TemplateLine, "item" | "shown_as">) =>
  line.shown_as ? `${line.shown_as} (${line.item.name})` : line.item.name;

/** A lore and when he may use it: "Tchar Rituals (with the Mark of Tchar the Eagle)". */
export const spellLabel = (spell: TemplateSpellType) =>
  spell.note ? `${spell.name} (${spell.note})` : spell.name;
