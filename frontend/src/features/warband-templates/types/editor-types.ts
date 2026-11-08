import type { SpecialCategory, SpecialKind } from "@/components/ui/game-icons";

import type {
  TemplateSpellType,
  TemplateVariant,
  TemplateWho,
  WarbandTemplate,
} from "./template-types";

/**
 * The template editor's read and every save's answer (the templates plan, phase 4): the template
 * as its detail reads it, where it comes from, what it was copied from and how many of the
 * campaign's warbands use it, and the server's warnings, each for a section (and a fighter's or a
 * list's key). Warnings never stop a save.
 */
export type EditorFacts = {
  source: "book" | "house" | "custom";
  copied_from: { id: number; name: string } | null;
  warbands: number;
};

export type EditorSection = "basics" | "fighters" | "lists" | "rules" | "upgrades";

export type EditorWarning = { section: EditorSection; key: string; text: string };

export type EditorAnswer = {
  template: WarbandTemplate;
  facts: EditorFacts;
  warnings: EditorWarning[];
};

/** A rule a fighter has or an upgrade gives: a special picked, or one written for the template. */
export type RuleInput =
  | { special_id: number }
  | { name: string; description: string; kind?: SpecialKind; category?: SpecialCategory };

export type BasicsInput = {
  name: string;
  setting_id: number | null;
  starting_gold: number | null;
  max_models: number | null;
  variants: TemplateVariant[];
  types: { id: number; variant: string }[];
};

export type FighterInput = {
  kind?: "hero" | "henchman";
  name: string;
  plural: string;
  race_id: number | null;
  cost: number;
  starting_xp: number;
  min_count: number;
  max_count: number | null;
  group_min: number | null;
  group_max: number | null;
  movement: number | string;
  weapon_skill: number | string;
  ballistic_skill: number | string;
  strength: number | string;
  toughness: number | string;
  wounds: number | string;
  initiative: number | string;
  attacks: number | string;
  leadership: number | string;
  skill_types: string[];
  spell_types: TemplateSpellType[];
  caster: string;
  is_leader: boolean;
  large: boolean;
  gains_xp: boolean;
  promotable: boolean;
  fixed_kit: string;
  lists: string[];
  rules: RuleInput[];
  /** The skills he starts with, in order. */
  skill_ids: number[];
};

export type LineInput = {
  id?: number;
  item_id: number;
  shown_as: string;
  cost: number | null;
  cost_note: string;
  first_free: boolean;
  brace_cost: number | null;
  who: TemplateWho;
  warband_max: number | null;
  note: string;
  variant: string;
};

export type ListInput = { name: string; note: string; fighters: string[]; lines: LineInput[] };

export type RuleRowInput = {
  id?: number;
  title: string;
  description: string;
  variant: string;
  warband_type_id: number | null;
};

export type UpgradeInput = {
  id?: number;
  group: string;
  rule: RuleInput;
  cost: number | null;
  cost_note: string;
  note: string;
  who: TemplateWho;
  max_per_fighter: number | null;
  later_double: boolean;
  at_recruit: boolean;
};

/** `POST warband-templates/`: blank (no `copy_of`) or a copy, serving the types named. */
export type MakeTemplateInput = { name: string; copy_of: number | null; type_ids: number[] };
