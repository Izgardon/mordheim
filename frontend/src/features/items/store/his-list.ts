import { lineName } from "@/features/warband-templates/template-view";
import type { TemplateVariant } from "@/features/warband-templates/types/template-types";
import { fighterLines, overWarbandMax } from "@/features/warbands/components/recruit/hire-draft";
import type {
  TemplateFighter,
  TemplateLine,
  TemplateUpgrade,
  WarbandTemplateAnswer,
} from "@/features/warbands/types/hire-template-types";
import type { HenchmenGroup, WarbandHero } from "@/features/warbands/types/warband-types";

import type { Item } from "../types/item-types";

/*
 * His list in the store (the templates plan, phase 3): buying for a unit recruited from the
 * warband's template (his `fighter_key`), the store can show only his lists' items, for the
 * warband's variant, at the store's price and rarity. Everything comes from the template the
 * roster reads ahead (`GET warbands/<id>/template/`); the server says who each line is for.
 */

/** The fighter the store is buying for, and his lists' lines for the warband's variant. */
export type HisList = { fighter: TemplateFighter; lines: TemplateLine[] };

/**
 * His list for the unit the store was opened for (its recipient key, "heroes:12"), or null: no
 * unit, the stash, a hired sword, a unit typed by hand, or a warband with no template.
 */
export function hisListFor(
  answer: WarbandTemplateAnswer | undefined,
  units: { heroes: WarbandHero[]; henchmenGroups: HenchmenGroup[] },
  recipientKey: string | null
): HisList | null {
  const template = answer?.template;
  const [kind, id] = (recipientKey ?? "").split(":");
  const list = kind === "heroes" ? units.heroes : kind === "henchmen" ? units.henchmenGroups : [];
  const key = list.find((unit) => String(unit.id) === id)?.fighter_key;
  const fighter = key ? template?.fighters.find((entry) => entry.key === key) : undefined;
  if (!template || !fighter) return null;
  return { fighter, lines: fighterLines(fighter, template.lists) };
}

/** His line for an item: one he is meant to take first, else the first (null: not on his list). */
export function hisLine(his: HisList, itemId: number): TemplateLine | null {
  const lines = his.lines.filter((line) => line.item.id === itemId);
  return lines.find((line) => !his.fighter.off_lines.includes(line.id)) ?? lines[0] ?? null;
}

/** What His list shows for an item: his list's name for it, why it is dimmed, the limit's warning. */
export function hisRow(his: HisList, line: TemplateLine, inBasket: number, copies: number) {
  return {
    name: lineName(line),
    off: his.fighter.off_lines.includes(line.id) ? line.who_text : "",
    limit: overWarbandMax(line, inBasket + copies),
  };
}

/** The warband's variant's terms (its rare search bonus), from the template read ahead. */
export const variantTerms = (answer: WarbandTemplateAnswer | undefined): TemplateVariant | null =>
  answer?.template?.variants.find((entry) => entry.key === answer.variant) ?? null;

/** The bonus a rare search starts on for an item: the variant's, unless it leaves the item out. */
export function rareBonusFor(terms: TemplateVariant | null, item: Pick<Item, "name">) {
  if (!terms?.rare_bonus || terms.rare_bonus_except?.includes(item.name)) return 0;
  return terms.rare_bonus;
}

/** The store's Upgrades for a hero from the template: his template's, those he isn't meant to take. */
export type HisUpgrades = {
  upgrades: TemplateUpgrade[];
  offUpgrades: number[];
  /** How many of a group he has: his specials that are its upgrades, and the basket's for him. */
  held: (group: string) => number;
  /** Whether he has the upgrade already (its special), or it is in the basket for him. */
  has: (upgrade: TemplateUpgrade) => boolean;
};

/** Upgrades for the hero the store is buying for (none for a group, or a template without any). */
export function hisUpgrades(
  answer: WarbandTemplateAnswer | undefined,
  his: HisList | null,
  hero: WarbandHero | undefined,
  basket: { id: number; group: string }[]
): HisUpgrades | null {
  const upgrades = answer?.template?.upgrades ?? [];
  if (!his || his.fighter.kind !== "hero" || !hero || !upgrades.length) return null;
  const specials = new Set((hero.specials ?? []).map((special) => special.id));
  return {
    upgrades,
    offUpgrades: his.fighter.off_upgrades,
    held: (group) =>
      upgrades.filter((upgrade) => upgrade.group === group && specials.has(upgrade.special_id))
        .length + basket.filter((line) => line.group === group).length,
    has: (upgrade) =>
      specials.has(upgrade.special_id) || basket.some((line) => line.id === upgrade.id),
  };
}
