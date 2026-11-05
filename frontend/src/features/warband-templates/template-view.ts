import { writtenNumber, type StatKey } from "@/features/catalogue/utils/statblock";
import { inPlayOnly } from "@/features/reference/in-play";
import type { WarbandTypeRow } from "@/features/warbands/types/warband-types";

import type {
  TemplateFighter,
  TemplateLine,
  TemplateRule,
  TemplateSpellType,
  WarbandTemplate,
  WarbandTemplateSummary,
} from "./types/template-types";

/** One row of the Warbands page: a warband type in play, and the template it uses (null: none). */
export type TemplateTypeRow = {
  id: string;
  typeName: string;
  template: WarbandTemplateSummary | null;
  /** The variant the type always is; "" when the player picks one. */
  variant: string;
  /** The warband type: a rule for one type shows on its row only. */
  typeId: number;
  /**
   * The template serves several types (Mercenaries, Tileans), so the row names it under the
   * type's name; a template of one type is only that type's name written another way.
   */
  shared: boolean;
};

/**
 * Each warband type in play in the campaign with its template (the reference pages' scoping: its
 * template's setting and its own), by name: a template serving four types gives four rows; a type
 * in play that no template serves is a row with none (Make a template).
 */
export function typeRows(
  templates: WarbandTemplateSummary[],
  /** The campaign's warband types: those in play that no template serves get a row too. */
  warbandTypes: WarbandTypeRow[] = []
): TemplateTypeRow[] {
  const served = new Set(templates.flatMap((template) => template.types.map((type) => type.id)));
  const types = [
    ...inPlayOnly(templates).flatMap((template) =>
      inPlayOnly(template.types)
        .filter((type) => !type.archived)
        .map((type) => ({
          template: template as WarbandTemplateSummary | null,
          type: {
            id: type.id,
            name: type.name,
            source_code: type.source_code,
            variant: type.variant,
          },
        }))
    ),
    ...inPlayOnly(warbandTypes)
      .filter((type) => !served.has(type.id))
      .map((type) => ({ template: null, type: { ...type, variant: "" } })),
  ];
  const named = new Map<string, number>();
  types.forEach(({ type }) => named.set(type.name, (named.get(type.name) ?? 0) + 1));
  return types
    .map(({ template, type }) => ({
      id: template ? `${template.id}-${type.id}` : `type-${type.id}`,
      // two types of one name ("Night Goblins") are told apart by their source, as the type picker does
      typeName:
        (named.get(type.name) ?? 0) > 1 && type.source_code
          ? `${type.name} (${type.source_code})`
          : type.name,
      template,
      variant: type.variant,
      typeId: type.id,
      shared: (template?.types.filter((entry) => !entry.archived).length ?? 0) > 1,
    }))
    .sort((a, b) => a.typeName.localeCompare(b.typeName) || a.id.localeCompare(b.id));
}

/** The rule pills for a type in a variant: every variant's and the variant's own, every type's and the type's own (the Ostermarkers'). */
export function rulesFor(
  template: WarbandTemplate,
  variant: string,
  typeId: number
): TemplateRule[] {
  return template.rules.filter(
    (rule) =>
      (!rule.variant || rule.variant === variant) &&
      (rule.warband_type_id === null || rule.warband_type_id === typeId)
  );
}

/** The starting gold and most warriors in a variant: its own (Marienburg's 600 gc), else the template's. */
export function termsFor(
  template: Pick<WarbandTemplateSummary, "gold" | "most_warriors" | "variants">,
  variant: string
) {
  const own = template.variants.find((entry) => entry.key === variant);
  return {
    gold: own?.starting_gold ?? template.gold,
    mostWarriors: own?.max_models ?? template.most_warriors,
  };
}

/** The fighter as the variant has him: its skill table, his profile as written (Middenheim's S4), his most. */
export function inVariant(fighter: TemplateFighter, variant: string): TemplateFighter {
  const change = fighter.variant_changes[variant];
  if (!change) return fighter;
  const shown = { ...fighter, written_stats: { ...(fighter.written_stats ?? {}) } };
  for (const [stat, value] of Object.entries(change.stats ?? {}) as [StatKey, number | string][]) {
    const text = String(value);
    const number = writtenNumber(text);
    shown[stat] = number;
    const rest = number === null ? text : text.slice(String(number).length);
    if (rest) shown.written_stats[stat] = rest;
    else delete shown.written_stats[stat];
  }
  if (change.skill_types) shown.skill_types = change.skill_types;
  if (change.max_count !== undefined) shown.max_count = change.max_count;
  return shown;
}

/** His skill groups in the variant: its own table where it has one. */
export const skillsFor = (fighter: TemplateFighter, variant: string) =>
  fighter.variant_changes[variant]?.skill_types ?? fighter.skill_types;

/** The skills the variant gives him from the start: the Hung's heroes' Ride [Animal]. */
export const startSkillsFor = (fighter: TemplateFighter, variant: string) =>
  (fighter.variant_changes[variant]?.skills ?? []).map((skill) => skill.name);

/** A list's lines in the variant: every variant's and its own (the Kurgan's bows). */
export const linesFor = <Line extends Pick<TemplateLine, "variant">>(
  lines: Line[],
  variant: string
) => lines.filter((line) => !line.variant || line.variant === variant);

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

/** The line's item as the list names it: "Jambiya (Dagger)", or the item's own name. */
export const lineName = (line: Pick<TemplateLine, "item" | "shown_as">) =>
  line.shown_as ? `${line.shown_as} (${line.item.name})` : line.item.name;

/** A lore and when he may use it: "Tchar Rituals (with the Mark of Tchar the Eagle)". */
export const spellLabel = (spell: TemplateSpellType) =>
  spell.note ? `${spell.name} (${spell.note})` : spell.name;
