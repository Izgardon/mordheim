import type {
  TemplateFighter as BookFighter,
  TemplateLine as BookLine,
  TemplateList as BookList,
  TemplateVariant,
} from "@/features/warband-templates/types/template-types";

import type { WarbandRule } from "./warband-types";

/*
 * A warband's template as the hire screens read it (`GET warbands/<id>/template/`, the templates
 * plan, phase 2) and a warband type's in outline for the raise screen. The server applies the
 * variant, counts what the warband has of each fighter and says who each line is for; the pages
 * only show it. The shapes build on the Warbands page's (features/warband-templates).
 */

/** A line with the reason anyone it isn't meant for sees it dimmed, and the copies held of a limited item. */
export type TemplateLine = BookLine & {
  /** "Gaolers only"; blank: everyone's. */
  who_text: string;
  /** With `warband_max`: the copies the warband holds now. */
  held: number | null;
};

export type TemplateList = Omit<BookList, "lines"> & { lines: TemplateLine[] };

/** A fighter as the warband's variant has him, with what the warband already has of him. */
export type TemplateFighter = Omit<BookFighter, "variant_changes"> & {
  /** Heroes on the roster recruited as him, or a henchman's living models and groups. */
  have: { count: number; groups: number };
  /** The lines of his lists he isn't meant to take (dimmed, still pickable). */
  off_lines: number[];
  /** The Dagger every hire of his gets free. */
  free_item: { id: number; name: string } | null;
};

export type WarbandTemplate = {
  id: number;
  campaign_id: number | null;
  replaces: number | null;
  name: string;
  gold: number;
  most_warriors: number;
  variants: TemplateVariant[];
  /** Its rules for the warband's variant (and type), in the book's order. */
  rules: WarbandRule[];
  lists: TemplateList[];
  fighters: TemplateFighter[];
  /** How many of those rules the warband has no rule of that title for. */
  missing_rules: number;
};

export type WarbandTemplateAnswer = {
  template: WarbandTemplate | null;
  variant: string;
  /** Kit at list prices in the hire screens, until the fight of the warband's first battle is over. */
  list_prices_open: boolean;
};

/** A fighter as the raise screen outlines him. */
export type OutlineFighter = Pick<
  TemplateFighter,
  | "key"
  | "kind"
  | "name"
  | "plural"
  | "cost"
  | "min_count"
  | "max_count"
  | "group_min"
  | "group_max"
>;

/** A warband type's template in outline (`GET campaigns/<id>/warband-types/<type>/template/`). */
export type RaiseOutline = {
  template: {
    id: number;
    name: string;
    variants: TemplateVariant[];
    /** The variant the type always is; blank: picked when raising. */
    preset_variant: string;
    variant: string;
    rules: WarbandRule[];
    fighters: OutlineFighter[];
  } | null;
  /** What the warband is raised with: the campaign's gold plus the template's difference from 500. */
  gold: number;
  /** The campaign's own starting gold, and the book's for the template (its variant's). */
  campaign_gold: number;
  book_gold?: number;
  most_warriors: number;
};
