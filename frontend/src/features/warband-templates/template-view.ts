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

/**
 * One row of the Warbands page: a warband type in play and the template it uses (null: none), or
 * a template that serves no type at all (`typeId` null), so it can be opened, edited and deleted.
 */
export type TemplateTypeRow = {
  id: string;
  /** The type's name, or the template's for one serving no type. */
  typeName: string;
  template: WarbandTemplateSummary | null;
  /** The variant the type always is; "" when the player picks one. */
  variant: string;
  /** The warband type: a rule for one type shows on its row only. */
  typeId: number | null;
  /**
   * Where it comes from, for the Setting column, filter and sort: the type's setting (a template
   * serving no type, the template's), and the campaign that owns it (null: the book).
   */
  setting: { setting_id: number | null; campaign_id: number | null };
  /**
   * The line under the name: the template's name where it serves several types (Mercenaries,
   * Tileans) or shares the type with another template; "No template", "No warband type".
   */
  sub?: string;
};

export const NO_TEMPLATE = "No template";
export const NO_TYPE = "No warband type";

const live = (template: WarbandTemplateSummary) => template.types.filter((type) => !type.archived);

/**
 * Each warband type in play in the campaign with its template (the reference pages' scoping: its
 * template's setting and its own), by name: a template serving four types gives four rows; a type
 * in play that no template serves is a row with none (Make a template), and a template serving
 * none is a row of its own (its editor warns).
 */
export function typeRows(
  templates: WarbandTemplateSummary[],
  /** The campaign's warband types: those in play that no template serves get a row too. */
  warbandTypes: WarbandTypeRow[] = []
): TemplateTypeRow[] {
  const served = new Set(templates.flatMap((template) => template.types.map((type) => type.id)));
  const types = [
    ...inPlayOnly(templates).flatMap((template) =>
      inPlayOnly(live(template)).map((type) => ({
        template: template as WarbandTemplateSummary | null,
        type: {
          id: type.id,
          name: type.name,
          source_code: type.source_code,
          variant: type.variant,
          setting: { setting_id: type.setting_id, campaign_id: type.campaign_id },
        },
      }))
    ),
    ...inPlayOnly(warbandTypes)
      .filter((type) => !served.has(type.id))
      .map((type) => ({
        template: null,
        type: {
          ...type,
          variant: "",
          setting: { setting_id: type.setting?.id ?? null, campaign_id: type.campaign_id },
        },
      })),
  ];
  const named = new Map<string, number>();
  const templatesOf = new Map<number, number>();
  types.forEach(({ type }) => {
    named.set(type.name, (named.get(type.name) ?? 0) + 1);
    templatesOf.set(type.id, (templatesOf.get(type.id) ?? 0) + 1);
  });
  const typed = types.map(({ template, type }) => ({
    id: template ? `${template.id}-${type.id}` : `type-${type.id}`,
    // two types of one name ("Night Goblins") are told apart by their source, as the type picker does
    typeName:
      (named.get(type.name) ?? 0) > 1 && type.source_code
        ? `${type.name} (${type.source_code})`
        : type.name,
    template,
    variant: type.variant,
    typeId: type.id as number | null,
    setting: type.setting,
    sub: !template
      ? NO_TEMPLATE
      : live(template).length > 1 || (templatesOf.get(type.id) ?? 0) > 1
        ? template.name
        : undefined,
  }));
  const typeless = inPlayOnly(templates)
    .filter((template) => !live(template).length)
    .map((template) => ({
      id: `template-${template.id}`,
      typeName: template.name,
      template: template as WarbandTemplateSummary | null,
      variant: "",
      typeId: null,
      setting: { setting_id: template.setting_id, campaign_id: template.campaign_id },
      sub: NO_TYPE,
    }));
  return [...typed, ...typeless].sort(
    (a, b) => a.typeName.localeCompare(b.typeName) || a.id.localeCompare(b.id)
  );
}

/** The rule pills for a type in a variant: every variant's and the variant's own, every type's and the type's own (the Ostermarkers'). */
export function rulesFor(
  template: WarbandTemplate,
  variant: string,
  /** Null for a template serving no type: its rules for every type. */
  typeId: number | null
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
