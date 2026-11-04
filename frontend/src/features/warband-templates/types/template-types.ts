import type { CatalogueBadgeFields } from "@/features/catalogue/types/catalogue-entry";
import type { CatalogueProfile } from "@/features/reference/profile";

/** A warband type a template serves, and the variant it always is ("" when the player picks). */
export type TemplateType = {
  id: number;
  name: string;
  slug: string;
  source_code: string;
  setting_id: number | null;
  campaign_id: number | null;
  variant: string;
  archived: boolean;
  in_play: boolean | null;
};

export type TemplateVariant = { key: string; name: string };

/** `GET warband-templates/?campaign_id=`: a template and the warband types it serves. */
export type WarbandTemplateSummary = CatalogueBadgeFields & {
  id: number;
  campaign_id: number | null;
  setting_id: number | null;
  name: string;
  slug: string;
  /** The book's figure (null: none, read as 500). */
  starting_gold: number | null;
  gold: number;
  max_models: number | null;
  most_warriors: number;
  variants: TemplateVariant[];
  source: string;
  link_url: string;
  types: TemplateType[];
};

export type TemplateRule = { id: number; title: string; description: string; variant: string };

/** Who may take a list line: everyone ({}), heroes, the fighters named, or all but some (by key). */
export type TemplateWho = { heroes?: boolean; fighters?: string[]; except?: string[] };

export type TemplateLine = {
  id: number;
  item: { id: number; name: string; variant: string; type: string };
  shown_as: string;
  cost: number | null;
  cost_note: string;
  first_free: boolean;
  brace_cost: number | null;
  who: TemplateWho;
  warband_max: number | null;
  note: string;
};

export type TemplateList = {
  id: number;
  key: string;
  name: string;
  note: string;
  lines: TemplateLine[];
};

export type TemplateSpecial = { id: number; name: string; kind: string; description: string };

export type TemplateSpellType = { name: string; note: string };

export type TemplateFighter = Omit<CatalogueProfile, "armour_save"> & {
  id: number;
  key: string;
  kind: "hero" | "henchman";
  name: string;
  plural: string;
  race_id: number | null;
  race: string | null;
  cost: number;
  starting_xp: number;
  min_count: number;
  max_count: number | null;
  group_min: number | null;
  group_max: number | null;
  skill_types: string[];
  spell_types: TemplateSpellType[];
  gains_xp: boolean;
  promotable: boolean;
  is_leader: boolean;
  caster: string;
  large: boolean;
  /** By variant key: what differs from the first variant's (its skill groups). */
  variant_changes: Record<string, { skill_types?: string[] }>;
  fixed_kit: string;
  /** The keys of the lists he buys from. */
  lists: string[];
  rules: TemplateSpecial[];
};

export type TemplateUpgrade = {
  id: number;
  group: string;
  name: string;
  description: string;
  cost: number | null;
  cost_note: string;
  note: string;
};

/** `GET warband-templates/:id/`: the whole template. */
export type WarbandTemplate = WarbandTemplateSummary & {
  rules: TemplateRule[];
  lists: TemplateList[];
  fighters: TemplateFighter[];
  upgrades: TemplateUpgrade[];
};
